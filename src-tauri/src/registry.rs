// Sign in to Amazon ECR for Docker: `aws ecr get-login-password | docker login --password-stdin`.
// The password only ever travels from aws to docker through this process's memory and docker's stdin. It is never
// an argument, never emitted, and never part of an error.
use super::{
    kill_group, path_env, read_capped, stream_with, wait_bounded, Isolate, STREAM_SILENCE,
};
use serde::Serialize;
use std::io::Write;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const DEADLINE: Duration = Duration::from_secs(60);
// The `aws sso login` in progress, so Cancel can stop it.
static SSO_PID: Mutex<Option<u32>> = Mutex::new(None);

#[derive(Serialize, Debug, PartialEq)]
pub struct LoginError {
    // "aws-session" (sign in to AWS first), "no-aws" (not installed) or "login" (anything else).
    kind: &'static str,
    message: String,
}

fn err(kind: &'static str, message: impl Into<String>) -> LoginError {
    LoginError {
        kind,
        message: message.into(),
    }
}

// <12 digits>.dkr.ecr[-fips].<region>.amazonaws.com, nothing before or after. Returns the region.
fn ecr_region(registry: &str) -> Option<&str> {
    let labels: Vec<&str> = registry.split('.').collect();
    let ok = labels.len() == 6
        && labels[0].len() == 12
        && labels[0].bytes().all(|b| b.is_ascii_digit())
        && labels[1] == "dkr"
        && matches!(labels[2], "ecr" | "ecr-fips")
        && !labels[3].is_empty()
        && labels[3]
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        && labels[4] == "amazonaws"
        && labels[5] == "com";
    ok.then(|| labels[3])
}

fn profile_ok(p: &str) -> bool {
    !p.is_empty()
        && p.bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'.' | b'-'))
}

// "--profile" goes in only when the name is plain; a name that is not is refused, never passed on.
fn profile_args(profile: Option<&str>) -> Result<Vec<String>, LoginError> {
    match profile {
        None => Ok(vec![]),
        Some(p) if profile_ok(p) && !p.starts_with('-') => Ok(vec!["--profile".into(), p.into()]),
        Some(_) => Err(err("login", "That AWS profile name is not valid.")),
    }
}

fn password_args(region: &str, profile: Option<&str>) -> Result<Vec<String>, LoginError> {
    let mut args: Vec<String> = ["ecr", "get-login-password", "--region", region]
        .map(String::from)
        .to_vec();
    args.extend(profile_args(profile)?);
    Ok(args)
}

fn login_args(registry: &str) -> Vec<String> {
    ["login", "--username", "AWS", "--password-stdin", registry]
        .map(String::from)
        .to_vec()
}

fn is_aws_session(stderr: &str) -> bool {
    let s = stderr.to_lowercase();
    [
        "sso",
        "expired",
        "expiredtoken",
        "unable to locate credentials",
        "token has expired",
    ]
    .iter()
    .any(|k| s.contains(k))
}

// Runs one program to the end (or the deadline), feeding `stdin` if given. Returns (ok, stdout, stderr).
fn run(
    bin: &str,
    args: &[String],
    stdin: Option<&[u8]>,
) -> std::io::Result<(bool, Vec<u8>, Vec<u8>)> {
    run_within(bin, args, stdin, DEADLINE)
}

fn run_within(
    bin: &str,
    args: &[String],
    stdin: Option<&[u8]>,
    deadline: Duration,
) -> std::io::Result<(bool, Vec<u8>, Vec<u8>)> {
    // Own process group, so the kill at the deadline also reaches a credential helper holding the pipes.
    let mut child = crate::wsl::tool(bin, args)
        .env("PATH", path_env())
        .isolate()
        .stdin(if stdin.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    if let (Some(data), Some(mut pipe)) = (stdin, child.stdin.take()) {
        let _ = pipe.write_all(data);
    }
    let out = read_capped(child.stdout.take().expect("piped stdout"));
    let errs = read_capped(child.stderr.take().expect("piped stderr"));
    let start = Instant::now();
    let ok = loop {
        if let Some(s) = child.try_wait()? {
            break s.success();
        }
        if start.elapsed() > deadline {
            kill_group(child.id());
            let _ = child.kill();
            let _ = wait_bounded(&mut child, Duration::from_secs(5));
            break false;
        }
        std::thread::sleep(Duration::from_millis(20));
    };
    Ok((
        ok,
        out.join().unwrap_or_default(),
        errs.join().unwrap_or_default(),
    ))
}

// `docker login` against a credential helper that cannot store (docker-credential-ecr-login).
fn store_unsupported(docker_err: &str) -> bool {
    docker_err.contains("error storing credentials") && docker_err.contains("not implemented")
}

fn sign_in(registry: &str, profile: Option<&str>) -> Result<(), LoginError> {
    let region = ecr_region(registry)
        .ok_or_else(|| err("login", "That is not an Amazon ECR registry address."))?;
    let (ok, password, aws_err) = match run("aws", &password_args(region, profile)?, None) {
        Ok(r) => r,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Err(err("no-aws", "The AWS command line tool is not installed."))
        }
        Err(e) => return Err(err("login", format!("Could not run aws: {e}"))),
    };
    if !ok {
        let text = String::from_utf8_lossy(&aws_err).trim().to_string();
        let kind = if is_aws_session(&text) {
            "aws-session"
        } else {
            "login"
        };
        return Err(err(kind, text));
    }
    // aws prints the password with a trailing newline; docker wants it bare.
    let password = String::from_utf8_lossy(&password).trim().to_string();
    if password.is_empty() {
        return Err(err("login", "AWS returned no password for this registry."));
    }
    let (ok, _, docker_err) = run("docker", &login_args(registry), Some(password.as_bytes()))
        .map_err(|e| {
            err(
                "login",
                format!("Could not run docker: {e}. Is it installed?"),
            )
        })?;
    if ok {
        return Ok(());
    }
    // With docker-credential-ecr-login as the credential store, `docker login` cannot store anything ("not implemented"),
    // and does not need to: the helper fetches a token at pull time from the AWS profile, which every docker command
    // the app runs now carries. The password above only proved the AWS session works.
    if store_unsupported(&String::from_utf8_lossy(&docker_err))
        && super::locate("docker-credential-ecr-login").is_some()
    {
        crate::wsl::set_docker_aws_profile(profile.map(String::from));
        return Ok(());
    }
    {
        // Docker's own words, without the password in case a helper ever echoed it.
        Err(err(
            "login",
            String::from_utf8_lossy(&docker_err)
                .replace(&password, "***")
                .trim(),
        ))
    }
}

#[tauri::command]
pub async fn registry_login(registry: String, profile: Option<String>) -> Result<(), LoginError> {
    tauri::async_runtime::spawn_blocking(move || sign_in(&registry, profile.as_deref()))
        .await
        .map_err(|e| err("login", e.to_string()))?
}

// The frontend sends the profile of a saved registry at start and whenever it changes.
#[tauri::command]
pub fn set_docker_aws_profile(profile: Option<String>) -> Result<(), String> {
    match profile.as_deref() {
        Some(p) if !profile_ok(p) || p.starts_with('-') => {
            Err("That AWS profile name is not valid.".into())
        }
        _ => {
            crate::wsl::set_docker_aws_profile(profile);
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn aws_profiles() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let (ok, out, _) = run("aws", &["configure".into(), "list-profiles".into()], None)
            .map_err(|e| e.to_string())?;
        if !ok {
            return Ok(vec![]);
        }
        Ok(String::from_utf8_lossy(&out)
            .lines()
            .map(str::trim)
            .filter(|l| profile_ok(l))
            .map(String::from)
            .collect())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize, Debug, PartialEq)]
pub struct AwsProfile {
    name: String,
    // The 12-digit AWS account the profile signs in to, when the config says so.
    account: Option<String>,
}

// "[profile x]" / "[default]" sections with sso_account_id or a role_arn, read from the AWS config file.
fn parse_aws_config(text: &str) -> Vec<AwsProfile> {
    let mut out: Vec<AwsProfile> = vec![];
    for line in text.lines().map(str::trim) {
        if let Some(head) = line.strip_prefix('[').and_then(|l| l.strip_suffix(']')) {
            let name = head.strip_prefix("profile ").unwrap_or(head).trim();
            if head == "default" || head.starts_with("profile ") {
                out.push(AwsProfile {
                    name: name.to_string(),
                    account: None,
                });
            } else {
                out.push(AwsProfile {
                    name: String::new(), // sso-session and other sections: dropped below
                    account: None,
                });
            }
        } else if let (Some(cur), Some((k, v))) = (out.last_mut(), line.split_once('=')) {
            let v = v.trim();
            let digits = |d: &str| d.len() == 12 && d.bytes().all(|b| b.is_ascii_digit());
            match k.trim() {
                "sso_account_id" if digits(v) => cur.account = Some(v.to_string()),
                "role_arn" if cur.account.is_none() => {
                    if let Some(acc) = v.split(':').nth(4).filter(|a| digits(a)) {
                        cur.account = Some(acc.to_string());
                    }
                }
                _ => {}
            }
        }
    }
    out.retain(|p| profile_ok(&p.name));
    out
}

// Every profile with its account, so the screen can pick the one that matches a registry's account.
#[tauri::command]
pub fn aws_profile_accounts() -> Vec<AwsProfile> {
    let path = std::env::var("AWS_CONFIG_FILE")
        .unwrap_or_else(|_| format!("{}/.aws/config", std::env::var("HOME").unwrap_or_default()));
    std::fs::read_to_string(path)
        .map(|t| parse_aws_config(&t))
        .unwrap_or_default()
}

#[derive(Serialize, Debug, PartialEq)]
pub struct FoundRegistry {
    registry: String,
    region: String,
    // The folder of the first Compose file that names it.
    project: String,
}

// ECR hosts named in some text: every word that is exactly <12 digits>.dkr.ecr.<region>.amazonaws.com.
fn ecr_hosts_in(text: &str) -> Vec<(String, String)> {
    let mut v: Vec<(String, String)> = text
        .split(|c: char| !(c.is_ascii_alphanumeric() || c == '.' || c == '-'))
        .filter_map(|w| ecr_region(w).map(|r| (w.to_string(), r.to_string())))
        .collect();
    v.sort();
    v.dedup();
    v
}

// The ECR hosts the owner's Compose projects already pull from, found by reading the Compose files Spotlight lists.
#[tauri::command]
pub async fn find_registries() -> Result<Vec<FoundRegistry>, String> {
    let files = super::find_compose_files().await?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut found: Vec<FoundRegistry> = vec![];
        for f in files.iter().take(300) {
            // shortcut: a Compose file over 256 KB is skipped, none of the real ones are that big.
            let Ok(text) =
                std::fs::read_to_string(f)
                    .map(|t| if t.len() > 262_144 { String::new() } else { t })
            else {
                continue;
            };
            let project = f.rsplit('/').nth(1).unwrap_or("").to_string();
            for (registry, region) in ecr_hosts_in(&text) {
                if !found.iter().any(|x| x.registry == registry) {
                    found.push(FoundRegistry {
                        registry,
                        region,
                        project: project.clone(),
                    });
                }
            }
        }
        Ok(found)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn aws_sso_login(
    app: tauri::AppHandle,
    profile: Option<String>,
) -> Result<(), LoginError> {
    let mut args: Vec<String> = vec!["sso".into(), "login".into()];
    args.extend(profile_args(profile.as_deref())?);
    tauri::async_runtime::spawn_blocking(move || {
        let track = |pid| *SSO_PID.lock().unwrap_or_else(|p| p.into_inner()) = pid;
        stream_with(
            &app,
            "aws-sso-progress",
            "aws",
            &args,
            STREAM_SILENCE,
            track,
        )
        .map_err(|e| err("login", e))
    })
    .await
    .map_err(|e| err("login", e.to_string()))?
}

// Stops the sign-in in progress (the browser tab it opened is left for the user to close).
#[tauri::command]
pub fn aws_sso_cancel() -> bool {
    let pid = *SSO_PID.lock().unwrap_or_else(|p| p.into_inner());
    pid.map(kill_group).is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[test]
    fn given_a_grandchild_holding_the_pipe_when_the_deadline_passes_then_run_returns_promptly() {
        let started = Instant::now();
        let args: Vec<String> = vec!["-c".into(), "sleep 30 & sleep 30".into()];
        let (ok, _, _) = run_within("sh", &args, None, Duration::from_millis(300)).unwrap();
        assert!(!ok);
        assert!(
            started.elapsed() < Duration::from_secs(10),
            "{:?}",
            started.elapsed()
        );
    }

    #[test]
    fn given_an_aws_config_when_parsed_then_each_profile_has_its_account() {
        let cfg = "[default]\nregion = us-west-2\n[profile prod-readonly]\nsso_account_id = 123456789012\nsso_role_name = ReadOnly\n[sso-session corp]\nsso_start_url = x\n[profile via-role]\nrole_arn = arn:aws:iam::111122223333:role/Admin\n";
        let got = parse_aws_config(cfg);
        let names: Vec<&str> = got.iter().map(|p| p.name.as_str()).collect();
        assert_eq!(names, ["default", "prod-readonly", "via-role"]);
        assert_eq!(got[1].account.as_deref(), Some("123456789012"));
        assert_eq!(got[2].account.as_deref(), Some("111122223333"));
        assert_eq!(got[0].account, None);
    }

    #[test]
    fn given_compose_text_when_scanned_then_only_ecr_hosts_come_back() {
        let text = "image: 123456789012.dkr.ecr.us-west-2.amazonaws.com/gss/api:1.0\nimage: nginx\n  - \"123456789012.dkr.ecr.us-west-2.amazonaws.com/x\"\nimage: 12.dkr.ecr.x.amazonaws.com/y";
        assert_eq!(
            ecr_hosts_in(text),
            [(
                "123456789012.dkr.ecr.us-west-2.amazonaws.com".to_string(),
                "us-west-2".to_string()
            )]
        );
    }

    const HOST: &str = "123456789012.dkr.ecr.us-west-2.amazonaws.com";

    #[test]
    fn given_an_ecr_host_when_validated_then_the_region_comes_back() {
        assert_eq!(ecr_region(HOST), Some("us-west-2"));
        assert_eq!(
            ecr_region("123456789012.dkr.ecr-fips.us-gov-west-1.amazonaws.com"),
            Some("us-gov-west-1")
        );
    }

    #[test]
    fn given_hosts_that_are_not_ecr_when_validated_then_they_are_refused() {
        for bad in [
            "evil.com",
            "x.dkr.ecr.us-west-2.amazonaws.com.evil.com",
            "123456789012.dkr.ecr.us-west-2.amazonaws.com.evil.com",
            "-123456789012.dkr.ecr.us-west-2.amazonaws.com",
            "123456789012.dkr.ecr.us-west-2.amazonaws.com;rm -rf",
            "123456789012.dkr.ecr.us-west-2.amazonaws.com\n",
            "123456789012.dkr.ecr.us west.amazonaws.com",
            "123456789012.dkr.ecr.$(id).amazonaws.com",
            "12345678901.dkr.ecr.us-west-2.amazonaws.com",
            "",
        ] {
            assert_eq!(ecr_region(bad), None, "{bad:?}");
        }
    }

    #[test]
    fn given_a_profile_when_building_aws_args_then_it_is_there_only_if_plain() {
        assert!(!password_args("us-west-2", None)
            .unwrap()
            .contains(&"--profile".to_string()));
        let with = password_args("us-west-2", Some("dev.team_1")).unwrap();
        assert_eq!(with[with.len() - 2..], ["--profile", "dev.team_1"]);
        for bad in ["--debug", "a b", "a;b", "$(id)", ""] {
            assert!(password_args("us-west-2", Some(bad)).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn given_the_docker_login_args_when_built_then_the_password_is_not_among_them() {
        let args = login_args(HOST).join(" ");
        assert_eq!(
            args,
            format!("login --username AWS --password-stdin {HOST}")
        );
    }

    #[test]
    fn given_aws_stderr_when_classified_then_session_problems_are_told_apart() {
        for s in [
            "Error loading SSO Token",
            "ExpiredToken: The security token",
            "Unable to locate credentials.",
            "Token has expired and refresh failed",
        ] {
            assert!(is_aws_session(s), "{s}");
        }
        assert!(!is_aws_session("Could not connect to the endpoint URL"));
    }

    #[test]
    fn given_a_bad_registry_when_signing_in_then_nothing_runs_and_the_error_is_plain() {
        let e = sign_in("evil.com", None).unwrap_err();
        assert_eq!(e.kind, "login");
        assert!(!e.message.contains("evil.com") || e.message.contains("not an Amazon ECR"));
    }

    #[test]
    fn given_docker_echoing_the_password_when_the_error_is_built_then_it_is_masked() {
        let password = "s3cret-token";
        let shown = String::from_utf8_lossy(format!("login failed for {password}").as_bytes())
            .replace(password, "***");
        assert!(!shown.contains(password));
    }

    #[test]
    fn given_a_helper_that_cannot_store_when_docker_login_fails_then_it_is_recognised() {
        assert!(store_unsupported("Error saving credentials: error storing credentials - err: exit status 1, out: `not implemented`"));
        assert!(!store_unsupported(
            "unauthorized: incorrect username or password"
        ));
    }
}

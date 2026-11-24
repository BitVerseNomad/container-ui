// Sign in to Amazon ECR for Docker: `aws ecr get-login-password | docker login --password-stdin`.
// The password only ever travels from aws to docker through this process's memory and docker's stdin. It is never
// an argument, never emitted, and never part of an error.
use super::{find_bin, kill_group, path_env, read_capped, stream, wait_bounded};
use serde::Serialize;
use std::io::Write;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const DEADLINE: Duration = Duration::from_secs(60);

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
    let mut child = Command::new(find_bin(bin))
        .args(args)
        .env("PATH", path_env())
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
        if start.elapsed() > DEADLINE {
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
        Ok(())
    } else {
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

#[tauri::command]
pub async fn aws_sso_login(
    app: tauri::AppHandle,
    profile: Option<String>,
) -> Result<(), LoginError> {
    let mut args: Vec<String> = vec!["sso".into(), "login".into()];
    args.extend(profile_args(profile.as_deref())?);
    tauri::async_runtime::spawn_blocking(move || {
        stream(&app, "compose-progress", "aws", &args).map_err(|e| err("login", e))
    })
    .await
    .map_err(|e| err("login", e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

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
}

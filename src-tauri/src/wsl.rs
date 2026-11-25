// Docker inside a WSL2 distro, driven from Windows: no docker.exe, so every engine command goes through
// `wsl.exe --exec <tool> ...`. The pure parts (argv, path translation, distro list) compile and test on every OS.
use std::process::Command;

const TOOLS: [&str; 3] = ["docker", "kubectl", "aws"];

// `-d` is always explicit when the user picked a distro; otherwise WSL's default distro answers.
pub fn wsl_prefix(distro: Option<&str>) -> Vec<String> {
    let mut v = vec![];
    if let Some(d) = distro.filter(|d| !d.is_empty()) {
        v.push("-d".to_string());
        v.push(d.to_string());
    }
    v.push("--exec".to_string());
    v
}

// C:\Users\me\x, c:/x, \\wsl$\Ubuntu\home\me and \\wsl.localhost\Ubuntu\home\me become Linux paths.
// Anything else (a flag, an image name, a Linux path) comes back unchanged.
pub fn to_wsl_path(p: &str) -> String {
    let b = p.as_bytes();
    if b.len() >= 3 && b[0].is_ascii_alphabetic() && b[1] == b':' && (b[2] == b'\\' || b[2] == b'/')
    {
        let rest = p[3..].replace('\\', "/");
        let rest = rest.trim_end_matches('/');
        let drive = (b[0] as char).to_ascii_lowercase();
        return if rest.is_empty() {
            format!("/mnt/{drive}")
        } else {
            format!("/mnt/{drive}/{rest}")
        };
    }
    for unc in [r"\\wsl$\", r"\\wsl.localhost\"] {
        if let Some(rest) = p.strip_prefix(unc) {
            // drop the distro name, keep the path inside it
            let inside = rest.split_once('\\').map_or("", |(_, r)| r);
            let inside = inside.replace('\\', "/");
            let inside = inside.trim_end_matches('/');
            return format!("/{inside}");
        }
    }
    p.to_string()
}

// The way back, for showing a path to the user: /mnt/c/x is C:\x, anything else lives in the distro.
pub fn to_windows_path(p: &str, distro: &str) -> String {
    if let Some(rest) = p.strip_prefix("/mnt/") {
        let (drive, tail) = rest.split_once('/').unwrap_or((rest, ""));
        if drive.len() == 1 && drive.as_bytes()[0].is_ascii_alphabetic() {
            let tail = tail.replace('/', "\\");
            return format!("{}:\\{tail}", drive.to_ascii_uppercase());
        }
    }
    if p.starts_with('/') && !distro.is_empty() {
        return format!(r"\\wsl.localhost\{distro}{}", p.replace('/', "\\"));
    }
    p.to_string()
}

// `wsl.exe -l -q` prints UTF-16LE with no BOM; read as UTF-8 it has a NUL between letters.
pub fn decode_utf16le(bytes: &[u8]) -> String {
    let units: Vec<u16> = bytes
        .chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .collect();
    String::from_utf16_lossy(&units)
}

// Names only. `docker-desktop` and `docker-desktop-data` are Docker Desktop's own, not a place to run docker.
pub fn parse_distros(bytes: &[u8]) -> Vec<String> {
    decode_utf16le(bytes)
        .lines()
        .map(|l| l.trim().trim_start_matches('\u{feff}').to_string())
        .filter(|l| !l.is_empty() && !l.starts_with("docker-desktop"))
        .collect()
}

pub fn distro_from_env() -> Option<String> {
    std::env::var("CONTAINER_UI_WSL_DISTRO")
        .ok()
        .filter(|d| !d.trim().is_empty())
}

// True on Windows when there is no docker.exe to run, so the engine must be in WSL.
#[cfg(windows)]
pub fn via_wsl() -> bool {
    use std::sync::OnceLock;
    static V: OnceLock<bool> = OnceLock::new();
    *V.get_or_init(|| {
        let found = super::find_bin("docker");
        !std::path::Path::new(&found).exists() && !on_path("docker.exe")
    })
}

#[cfg(windows)]
fn on_path(exe: &str) -> bool {
    std::env::var_os("PATH")
        .is_some_and(|p| std::env::split_paths(&p).any(|d| d.join(exe).exists()))
}

#[cfg(not(windows))]
pub fn via_wsl() -> bool {
    false
}

// The command for one engine tool. Through WSL only for the tools that live in the distro.
// Windows paths in `args` become Linux paths; the working folder is mapped by wsl.exe itself.
pub fn tool(bin: &str, args: &[String]) -> Command {
    if via_wsl() && TOOLS.contains(&bin) {
        let mut c = Command::new("wsl.exe");
        c.args(wsl_prefix(distro_from_env().as_deref()))
            .arg(bin)
            .args(args.iter().map(|a| to_wsl_path(a)));
        return c;
    }
    let mut c = Command::new(super::find_bin(bin));
    c.args(args);
    c
}

// Same, with stderr folded into stdout in the order written (logs, pulls). The shell that does it runs
// where the tool runs: sh on the Mac, sh inside the distro through WSL, nothing extra on plain Windows.
pub fn tool_merged(bin: &str, args: &[String]) -> Command {
    const FOLD: [&str; 4] = ["-c", "exec \"$@\" 2>&1", "sh", ""];
    if via_wsl() && TOOLS.contains(&bin) {
        let mut c = Command::new("wsl.exe");
        c.args(wsl_prefix(distro_from_env().as_deref()))
            .args(["sh", FOLD[0], FOLD[1], FOLD[2], bin])
            .args(args.iter().map(|a| to_wsl_path(a)));
        return c;
    }
    #[cfg(unix)]
    {
        let mut c = Command::new("sh");
        c.args([FOLD[0], FOLD[1], FOLD[2], &super::find_bin(bin)])
            .args(args);
        c
    }
    #[cfg(not(unix))]
    tool(bin, args)
}

// wsl.exe writes its own messages in UTF-16LE (NULs between letters) and the tool's in UTF-8.
pub fn text_of(bytes: &[u8]) -> String {
    if bytes.len() >= 2 && bytes.iter().skip(1).step_by(2).filter(|b| **b == 0).count() * 3 > bytes.len() {
        decode_utf16le(bytes)
    } else {
        String::from_utf8_lossy(bytes).into_owned()
    }
}

// The usual reasons the engine is out of reach through WSL, in plain words. None when the text is something else.
pub fn explain(text: &str) -> Option<String> {
    let t = text.to_lowercase();
    let has = |s: &str| t.contains(s);
    let msg = if has("no installed distributions") || has("there is no distribution") {
        "No Linux distribution is installed in WSL. In PowerShell run `wsl --install -d Ubuntu`, restart, then install Docker inside it."
    } else if has("execvpe(docker) failed") || has("\"docker\": executable file not found") || has("docker: not found") || has("docker: command not found") {
        "Docker is not installed inside your WSL distro. Install it there (for Ubuntu: `sudo apt install docker.io`), then reopen this app."
    } else if has("cannot connect to the docker daemon") || has("is the docker daemon running") {
        "Docker is installed in WSL but not running. In your WSL terminal run `sudo service docker start`."
    } else if has("permission denied while trying to connect to the docker") {
        "Your WSL user cannot use Docker. In your WSL terminal run `sudo usermod -aG docker $USER`, then run `wsl --shutdown` and reopen this app."
    } else if has("wsl_e_wsl_optional_component_required") || has("windows subsystem for linux has not been enabled") {
        "Windows Subsystem for Linux is not turned on. In PowerShell run `wsl --install`, then restart Windows."
    } else {
        return None;
    };
    Some(msg.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn given_a_drive_path_when_translated_then_it_lives_under_mnt() {
        assert_eq!(to_wsl_path(r"C:\Users\me\x"), "/mnt/c/Users/me/x");
        assert_eq!(to_wsl_path("c:/Users/me/x"), "/mnt/c/Users/me/x");
        assert_eq!(to_wsl_path(r"D:\"), "/mnt/d");
        assert_eq!(to_wsl_path(r"C:\Program Files\app\"), "/mnt/c/Program Files/app");
    }

    #[test]
    fn given_a_wsl_unc_path_when_translated_then_the_distro_name_goes() {
        assert_eq!(to_wsl_path(r"\\wsl$\Ubuntu\home\me"), "/home/me");
        assert_eq!(to_wsl_path(r"\\wsl.localhost\Ubuntu\home\me\app\"), "/home/me/app");
        assert_eq!(to_wsl_path(r"\\wsl$\Ubuntu"), "/");
    }

    #[test]
    fn given_things_that_are_not_windows_paths_when_translated_then_they_are_untouched() {
        for s in ["ps", "--format", "/home/me", "nginx:latest", "a:b", "C:", ""] {
            assert_eq!(to_wsl_path(s), s, "{s:?}");
        }
    }

    #[test]
    fn given_linux_paths_when_shown_then_they_map_back() {
        assert_eq!(to_windows_path("/mnt/c/Users/me", "Ubuntu"), r"C:\Users\me");
        assert_eq!(to_windows_path("/mnt/d", "Ubuntu"), r"D:\");
        assert_eq!(
            to_windows_path("/home/me/x", "Ubuntu"),
            r"\\wsl.localhost\Ubuntu\home\me\x"
        );
        assert_eq!(to_windows_path("relative", "Ubuntu"), "relative");
    }

    #[test]
    fn given_a_distro_choice_when_building_argv_then_d_is_explicit_only_if_chosen() {
        assert_eq!(wsl_prefix(None), ["--exec"]);
        assert_eq!(wsl_prefix(Some("")), ["--exec"]);
        assert_eq!(wsl_prefix(Some("Debian")), ["-d", "Debian", "--exec"]);
    }

    #[test]
    fn given_wsl_list_output_when_parsed_then_names_come_back_without_docker_desktop() {
        let text = "\u{feff}Ubuntu\r\ndocker-desktop\r\ndocker-desktop-data\r\nDebian\r\n";
        let bytes: Vec<u8> = text.encode_utf16().flat_map(u16::to_le_bytes).collect();
        assert_eq!(parse_distros(&bytes), ["Ubuntu", "Debian"]);
        assert!(parse_distros(&[]).is_empty());
    }

    #[test]
    fn given_wsl_messages_when_read_then_utf16_and_utf8_both_decode() {
        let wide: Vec<u8> = "no installed distributions".encode_utf16().flat_map(u16::to_le_bytes).collect();
        assert_eq!(text_of(&wide), "no installed distributions");
        assert_eq!(text_of(b"Cannot connect"), "Cannot connect");
        assert_eq!(text_of(&[]), "");
    }

    #[test]
    fn given_known_failures_when_explained_then_the_fix_is_named_and_unknown_text_passes() {
        for (raw, word) in [
            ("Windows Subsystem for Linux has no installed distributions.", "wsl --install"),
            ("wsl: execvpe(docker) failed: No such file or directory", "apt install docker.io"),
            ("Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?", "service docker start"),
            ("permission denied while trying to connect to the Docker daemon socket", "usermod -aG docker"),
        ] {
            assert!(explain(raw).is_some_and(|m| m.contains(word)), "{raw}");
        }
        assert_eq!(explain("no such container: web"), None);
    }
}

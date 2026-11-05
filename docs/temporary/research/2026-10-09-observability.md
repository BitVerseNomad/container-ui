# Research notes: observability (health, events, restarts, disk)
Checked on 2026-10-09. Each fact is from the linked page unless marked unverified.

## Events (activity timeline)
- Containers report `die`, `health_status` and `oom` events. `--since` accepts timestamps or durations like `10m`; `--until` ends the stream at a timestamp; `--filter` takes key=value (`container=`, `event=`, `type=`); `--format '{{json .}}'` streams JSON Lines. The plain format shows `container die <id> (exitCode=143, image=alpine:latest, name=test)`, so exit code, image and name are event attributes.
  https://docs.docker.com/reference/cli/docker/system/events/
- Design consequence: `docker events` streams forever unless `--until` is given, so the app only ever runs it with both `--since` and `--until` (the Rust allowlist refuses any other form), and polls a recent window.

## Health
- Health states are `starting`, `healthy`, `unhealthy`. Inspect exposes `State.Health.Status`, `FailingStreak` (consecutive failures) and `Log` (the last few results, oldest first), each with `ExitCode` (0 healthy, 1 unhealthy, 2 reserved and treated as unhealthy, anything else means the probe itself failed to run) and `Output` (output of that check).
  https://github.com/sld880311/docker/blob/d5593973a475/api/types/types.go (Docker API types)
- Design consequence: show the last check's output when a container is unhealthy; say plainly when an image defines no health check.

## Disk usage
- `docker system df -v` reports per image SIZE (virtual size = SHARED SIZE + UNIQUE SIZE) and CONTAINERS count, per container SIZE, and per volume LINKS (containers using it) and SIZE. `--format json` exists for `docker system df`.
  https://docs.docker.com/reference/cli/docker/system/df/
- UNVERIFIED: the exact JSON shape of `docker system df -v --format json`. The parser must tolerate it being absent; volume sizes show a dash if it can't be read, until checked on a real VM.

## Unverified until run on a real VM
- The exact JSON fields of `docker events --format '{{json .}}'` (expected: Type, Action, Actor.Attributes.name/exitCode/image, time).
- The `Status` text in `docker ps` for health, e.g. "Up 2 hours (healthy)" (the app reads health from `docker inspect`, not from that text).
- (now checked, see below) Exit-code meanings.

## Exit codes (checked 2026-10-09)
- Docker's own CLI source for `docker run` returns 127 when the command isn't found, 126 when it can't be invoked, and 125 for generic Docker daemon failures.
  https://github.com/stapelberg/docker/blob/46a61b72402e/api/client/run.go (fork of moby/moby)
- Signal exits are 128 + the signal number: SIGKILL (9) is 137, SIGTERM (15) is 143; sources cited: Bash Reference Manual (Exit Status) and Linux signal(7). 143 is a graceful stop and usually needs no troubleshooting; 139 is a segmentation fault; 255 is out of range; 128 on its own is an application-specific code and must not be read as a signal.
  https://komodor.com/learn/exit-codes-in-containers-and-kubernetes-the-complete-guide/
  https://oneuptime.com/blog/post/2026-02-08-how-to-interpret-all-docker-container-exit-codes/markdown
- 137 means SIGKILL, which is an out-of-memory kill OR a forced kill, so the app only says "out of memory" when Docker's own `State.OOMKilled` flag is true, and otherwise says "killed".

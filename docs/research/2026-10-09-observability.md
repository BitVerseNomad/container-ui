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
- Exit-code meanings: Docker documents 125, 126 and 127 for `docker run`; the 128+signal convention (137 killed, 143 terminated) is general Linux behaviour. Cite sources when this is built.

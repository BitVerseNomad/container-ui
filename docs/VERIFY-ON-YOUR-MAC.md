# Verifying on your Mac (about 15 minutes)

Everything so far was tested against a simulated Docker/Colima/kubectl in a browser, plus unit tests. The Rust side has never been compiled by the author. This list is the quickest way to find out what really works. Tick what passes, note what doesn't, and send the notes back.

## 0. Build
- [ ] `npm install` then `npx tauri icon icon.png` (one time) then `cd src-tauri && cargo test` — all Rust tests pass?
- [ ] `npm run tauri dev` — the window opens, no blank screen?

## 1. Core (needs Colima running)
- [ ] Overview shows the VM as running, with meters and your containers.
- [ ] Run an image (try `nginx`): Run panel opens, ports prefilled, **Run** works, the container page opens.
- [ ] Stop and Restart the VM from the Overview; the output log reads cleanly (no escape codes).
- [ ] Delete an image and a volume: a confirmation appears and it works.

## 2. Networking
- [ ] Networks tab lists your real networks with container addresses.
- [ ] Connection doctor: run two containers on different networks, e.g. `docker run -d --name a nginx` and `docker run -d --name b nginx`, then check a to b. Expect "don't share a network"; press the fix; check again.
- [ ] After the fix the name resolves and the port answers (this is the helper container `nicolaka/netshoot`; first run downloads it). If it shows an odd result, run `docker run --rm --network container:a nicolaka/netshoot sh -c 'nslookup b; nc -zv -w 3 b 80'` and send me the output.

## 3. Observability
- [ ] A container with a failing health check shows "unhealthy" and what the check said: `docker run -d --name sick --health-cmd "false" --health-interval 5s nginx`.
- [ ] Activity tab shows events (if empty, run `docker events --since 1h --until 0s --format '{{json .}}' | head -3` and send me one line).
- [ ] Volumes show sizes (if they show a dash, run `docker system df -v --format json | head -c 600` and send me the start of it).

## 4. Kubernetes (optional)
- [ ] `brew install kubectl`, then the Kubernetes tab offers "Turn on Kubernetes"; after the restart pods appear.
- [ ] `kubectl config get-contexts -o name` — is the Colima context called `colima` (or `colima-<profile>`)? If not, send me the names.
- [ ] "Open in k9s" opens Terminal (macOS may ask permission the first time).

## 5. Anything that looked wrong
Send a screenshot and, for Colima output that looked odd, the **Copy raw output** text.

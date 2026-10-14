# Side-by-side: lazydocker, Podman Desktop, ColimaStack (and ours)

Goal: find out which tool actually helps you most, on the same problems, in about an hour. Use the scorecard page to record results and send me the summary.

## 1. Create the same problems for every tool
```
cd ~/Downloads/colima-ui
bash scripts/eval-setup.sh        # creates eval-* containers, volumes, a network, and (optional) Kubernetes pods
```
It only touches things named `eval-*`. Remove everything afterwards with `bash scripts/eval-teardown.sh`.

| Scenario | What it is | The task to give each tool |
|---|---|---|
| A | `eval-client` can't reach `eval-server` (different networks, and a setting pointing at localhost; stand-in for Kafka and Kafka UI) | Find out why and fix it. Check with `docker exec eval-client wget -qO- -T 3 http://eval-server \| head -1` |
| B | `eval-unhealthy` has a failing health check | See that it is unhealthy and why |
| C | `eval-crash` keeps restarting | Understand why |
| D | `eval-oom` is killed for using too much memory | Understand why it stopped |
| E | one used volume, one unused named volume (`eval-unused-data`), one unused anonymous volume | Clean up unused volumes without losing `eval-unused-data` |
| F (optional) | Kubernetes namespace `eval`: a crash loop, an image that can't be pulled, a pod too big to place | See why each fails |

Also try, in each tool: run a new `nginx` container with a port and an environment variable; read live logs while scrolling; start, stop and restart the Colima VM.

## 2. Install each tool
- **lazydocker** (terminal): `brew install lazydocker`, then run `lazydocker`. If it shows nothing, point docker at Colima first: `docker context use colima`.
- **Podman Desktop**: `brew install --cask podman-desktop` (or the downloads page at podman-desktop.io/downloads). Its documentation says the Docker extension registers a running Docker engine's socket; whether it picks up Colima's socket automatically is unverified. If it shows no containers, note what it shows instead and tell me.
- **ColimaStack**: needs macOS 14 or later and Xcode; there is no release, you build it from source. Repository: github.com/RealDyllon/ColimaStack (follow its README; I haven't verified the build steps).
- **Ours**: the real app, not the browser preview (the preview is simulated): `git checkout integration`, `npm install`, `npx tauri icon icon.png`, `npm run tauri dev`. Expect rough edges the first time; `docs/VERIFY-ON-YOUR-MAC.md` lists what to check.

## 3. Score
Give each tool about 10 minutes per scenario group. For every task pick one of: **Easy**, **Possible, but hard**, **Can't**. Add a short note ("had to open a terminal", "took 5 minutes", "didn't explain why"). Use the scorecard page; it adds up the totals and makes a summary you can paste back to me.

## 4. What I'll do with the answer
- If one tool wins clearly on the tasks you care about, use it, and I'll narrow our project to what it lacks.
- If the guidance tasks (A to D) are where everything struggles, that is where ours should keep investing.
- Anything ours fails on the real app goes straight onto the fix list.

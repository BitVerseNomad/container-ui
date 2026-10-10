# Research notes: Kubernetes (checked 2026-10-10)

## Pod problems and what each one means
- Container waiting reasons Kubernetes reports: ContainerCreating, CrashLoopBackOff, CreateContainerConfigError, CreateContainerError, ErrImagePull, ImagePullBackOff, InvalidImageName, PodInitializing. Terminated reasons: Completed, ContainerCannotRun, DeadlineExceeded, Error, Evicted, OOMKilled.
  https://learn.netdata.cloud/docs/collecting-metrics/containers-and-vms/kubernetes-cluster-state
- Suggested actions: CrashLoopBackOff, check logs for the root cause; ImagePullBackOff, verify the image name and registry access; ErrImagePull, check image name, tag and pull secrets; OOMKilled (current or previous), increase memory limits; a Pending pod with a waiting reason is waiting for that reason; the pod-level `Unschedulable` condition, check node resources, taints/tolerations and node selectors.
  https://docs.nvidia.com/aiperf/dev/kubernetes/debug-command.md
- CrashLoopBackOff is the kubelet's restart-backoff state after repeated failures (exponential backoff, up to 5 minutes between restarts); ImagePullBackOff is the kubelet backing off repeated pull attempts; where to look in the JSON: `status.containerStatuses[].state.waiting.reason` and last termination reason.
  https://www.golinuxcloud.com/kubernetes-pod-troubleshooting/
  https://kx.cloudingenium.com/kubernetes-pod-troubleshooting-guide

## Colima
- `colima start --kubernetes` (`-k`); `--kubernetes-disable=coredns,servicelb,traefik,local-storage,metrics-server` can switch bundled components off; `--activate` (default true) sets the active Docker and Kubernetes context on startup; `-p <profile>` selects a profile. Docker contexts are `colima` (default profile) and `colima-<profile>`.
  https://zenn.dev/marumarumeruru/articles/8de277c0626c25
  https://openskillindex.com/skills/majiayu000-claude-skill-registry-colima
- UNVERIFIED: the Kubernetes context is assumed to be named the same way (`colima`, `colima-<profile>`); the app lists the real contexts with `kubectl config get-contexts -o name` and picks the match, and says so if there isn't one.
- A comparable open-source macOS app, ColimaStack, reads Kubernetes state through kubectl and also shows command history, stdout/stderr and Colima daemon logs and a diagnostics view. Worth learning from: command transparency (a log of what the app ran) and a toolchain diagnostics page. Not built yet.
  https://github.com/realdyllon/ColimaStack

## Tools
- `brew install kubectl`, `brew install k9s`; `k9s --context <name>` starts k9s in an existing context (see 2026-10-08 notes).

## Unverified until run on a real machine
- Opening Terminal with a command through `osascript` (`tell application "Terminal" to do script ...`); macOS will ask permission the first time ("wants to control Terminal").
- The Kubernetes context name Colima registers; the exact kubectl JSON for the lists (standard Kubernetes API objects: items[].metadata/spec/status).

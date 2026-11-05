#!/usr/bin/env bash
# Creates small, harmless problem scenarios (everything is named eval-*) so you can compare container UIs on the same situations.
# Needs Colima running and the docker CLI pointed at it (docker context use colima). Kubernetes scenarios are optional.
# Remove everything again with scripts/eval-teardown.sh.
set -uo pipefail

STATE=/tmp/eval-anon-volume
CTX="${KUBE_CONTEXT:-colima}"

say() { printf '\n== %s\n' "$*"; }
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1"; exit 1; }; }

need docker
docker info >/dev/null 2>&1 || { echo "Docker isn't answering. Start Colima (colima start) and check: docker context ls"; exit 1; }

"$(dirname "$0")/eval-teardown.sh" quiet

say "Pulling small images (first run only)"
docker pull -q alpine:3.20 >/dev/null && docker pull -q nginx:alpine >/dev/null && echo "ok"

say "A: a client that can't reach a server (different networks, and a setting pointing at localhost)"
docker network create eval-net >/dev/null
docker run -d --name eval-server --network eval-net nginx:alpine >/dev/null
docker run -d --name eval-client -e TARGET_URL=http://localhost:80 alpine:3.20 sleep 86400 >/dev/null
echo "eval-client is on the default network; eval-server is on eval-net."
echo "Goal: make eval-client reach eval-server. Test with:"
echo "  docker exec eval-client wget -qO- -T 3 http://eval-server | head -1"

say "B: a container whose health check fails"
docker run -d --name eval-unhealthy --health-cmd "false" --health-interval 5s --health-retries 2 nginx:alpine >/dev/null
echo "eval-unhealthy turns 'unhealthy' after about 10 seconds."

say "C: a container that keeps crashing and restarting"
docker run -d --name eval-crash --restart always alpine:3.20 sh -c 'echo starting; echo "ERROR: cannot connect to database eval-db:5432" >&2; exit 3' >/dev/null
echo "eval-crash exits with code 3 and restarts."

say "D: a container killed for using too much memory"
docker run -d --name eval-oom --memory 16m --memory-swap 16m alpine:3.20 sh -c 'tail /dev/zero' >/dev/null
echo "eval-oom is killed within a few seconds (exit code 137, out of memory)."

say "E: volumes: one in use, one unused, one anonymous and unused"
docker volume create eval-used-data >/dev/null
docker volume create eval-unused-data >/dev/null
docker run -d --name eval-vol -v eval-used-data:/data alpine:3.20 sleep 86400 >/dev/null
docker run --name eval-anon -v /anon alpine:3.20 true >/dev/null
anon=$(docker inspect -f '{{range .Mounts}}{{.Name}}{{end}}' eval-anon)
docker rm eval-anon >/dev/null
echo "$anon" > "$STATE"
echo "In use: eval-used-data. Unused named: eval-unused-data. Unused anonymous: ${anon:0:12}..."
echo "Goal: clean up unused volumes WITHOUT losing eval-unused-data by accident."

say "F (optional): Kubernetes pods that fail in three different ways"
if command -v kubectl >/dev/null 2>&1 && kubectl --context "$CTX" get nodes >/dev/null 2>&1; then
  kubectl --context "$CTX" apply -f - >/dev/null <<'YAML'
apiVersion: v1
kind: Namespace
metadata: { name: eval }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: eval-crash, namespace: eval }
spec:
  replicas: 1
  selector: { matchLabels: { app: eval-crash } }
  template:
    metadata: { labels: { app: eval-crash } }
    spec:
      containers:
        - name: app
          image: busybox:1.36
          command: ["sh", "-c", "echo 'ERROR: config file missing'; exit 1"]
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: eval-badimage, namespace: eval }
spec:
  replicas: 1
  selector: { matchLabels: { app: eval-badimage } }
  template:
    metadata: { labels: { app: eval-badimage } }
    spec:
      containers:
        - name: app
          image: ghcr.io/eval-nonexistent-org/nope:1
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: eval-toobig, namespace: eval }
spec:
  replicas: 1
  selector: { matchLabels: { app: eval-toobig } }
  template:
    metadata: { labels: { app: eval-toobig } }
    spec:
      containers:
        - name: app
          image: busybox:1.36
          command: ["sleep", "86400"]
          resources: { requests: { memory: 900Gi } }
YAML
  echo "Created namespace eval: a crash loop, an image that can't be pulled, and a pod too big to place."
else
  echo "Skipped: kubectl or a '$CTX' cluster isn't available (turn on Kubernetes: colima start --kubernetes)."
fi

say "Done. Give each tool the same tasks. Clean up afterwards with scripts/eval-teardown.sh"

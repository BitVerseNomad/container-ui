#!/usr/bin/env bash
# Removes everything scripts/eval-setup.sh created. Only touches resources named eval-*.
set -uo pipefail
STATE=/tmp/eval-anon-volume
CTX="${KUBE_CONTEXT:-colima}"
quiet=${1:-}
log() { [ "$quiet" = quiet ] || echo "$*"; }

for c in eval-server eval-client eval-unhealthy eval-crash eval-oom eval-vol eval-anon; do
  docker rm -f "$c" >/dev/null 2>&1 && log "removed container $c"
done
for v in eval-used-data eval-unused-data; do
  docker volume rm "$v" >/dev/null 2>&1 && log "removed volume $v"
done
if [ -f "$STATE" ]; then
  docker volume rm "$(cat "$STATE")" >/dev/null 2>&1 && log "removed the anonymous volume"
  rm -f "$STATE"
fi
docker network rm eval-net >/dev/null 2>&1 && log "removed network eval-net"
if command -v kubectl >/dev/null 2>&1; then
  kubectl --context "$CTX" delete namespace eval --ignore-not-found >/dev/null 2>&1 && log "removed Kubernetes namespace eval"
fi
exit 0

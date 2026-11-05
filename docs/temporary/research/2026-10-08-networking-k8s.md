# Research notes: container networking, troubleshooting, Kubernetes, terminal UIs
Checked on 2026-10-08. Each fact is from the linked page.

## Troubleshooting container-to-container connections (the "UI can't reach the server" case)
- Systematic order: verify both containers share the same custom (user-defined) network, not the default bridge; test DNS; test the port; then look at listeners and firewall.
  https://oneuptime.com/blog/post/2026-03-20-portainer-troubleshoot-network-connectivity/view
- DNS check: `nslookup <name>`; port check: `nc -zv <name> <port>` (commonly run through `docker exec` or a debug container).
  https://oneuptime.com/blog/post/2026-01-22-debug-docker-network-connectivity/view
- A throwaway debug container avoids needing tools inside the user's images: `docker run --rm --network <network> nicolaka/netshoot ...`, or `--network container:<name>` to test from the affected container's own network namespace (the viewpoint of the client that can't connect). Docker's own troubleshooting guidance uses the same approach.
  https://github.com/nicolaka/netshoot
  https://docs.mirantis.com/containers/v3.0/dockeree-solution-guides/troubleshooting/troubleshooting-networking.html
- Network membership and addresses: `docker network inspect <network> --format ...`; attach a running container with `docker network connect <network> <container>`.
- Design consequences: (1) probe from the client's namespace with a helper container, not `docker exec`; (2) check the client's environment for values pointing at localhost/127.0.0.1, which inside a container means the container itself; (3) when every network check passes but the app still fails, say so plainly: some services hand clients a different address after the first connection, so read the image's own setup notes.

## Colima and Kubernetes
- Start with `colima start --kubernetes` (`-k`); Colima runs a standalone K3s server; `--kubernetes-version` picks a K3s version; `--activate` sets the active Docker/Kubernetes context; `colima kubernetes` manages the cluster; kubectl is required (`brew install kubectl`). With the Docker runtime, images built or pulled with Docker are visible to Kubernetes.
  https://pkg.go.dev/github.com/abiosoft/colima@v0.3.3-pre-01
  https://dev.to/ths83/how-colima-is-a-good-alternative-to-docker-desktop-4ap6
  https://zenn.dev/marumarumeruru/articles/8de277c0626c25
- `colima start` also accepts `--dns` and `--dns-host name=ip` (network-relevant settings not yet in the app).

## Terminal UIs
- k9s: `brew install k9s`; `k9s --context <name>` starts in an existing kube context; `--readonly` disables changes; `k9s info` prints its config locations.
  https://github.com/derailed/k9s
- lazydocker: not verified yet; research before building.

## Not yet researched (do before building each)
- `docker events` and health status fields, `docker system df -v` for volume sizes, `docker network connect/disconnect/rm`, launching a command in Terminal.app from a desktop app, kubectl JSON output for pods/deployments/services.

## Built so far (networking) and what is unverified
- Built: Networks tab, connection doctor, container Network tab; pure logic in `src/lib/network.ts` with tests; Rust `network_probe` (helper container in the client's namespace; target and port passed as positional parameters) and `network` subcommands on the allowlist.
- Unverified until run on a real Colima VM: the exact `nslookup` and `nc` output inside `nicolaka/netshoot` (the app trusts the `::dns-exit` / `::tcp-exit` markers for pass/fail and only reads the resolved address from nslookup), and that `docker run --network container:<name>` works for every container state.

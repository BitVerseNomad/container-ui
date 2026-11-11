# Landscape: open-source container UIs (scouted 2026-10-11)

Only what each project's own page or a comparison article says; nothing here was run.

## Native Colima GUI
- **ColimaStack** (macOS, SwiftUI, MIT; 1 star, 34 commits, no releases, build from source): profile management; runtime overview; Docker inventory (containers, images, volumes, networks, stats, disk usage); Kubernetes visibility (nodes, namespaces, pods, deployments, services, metrics); diagnostics; command transparency (operations, command history, stdout/stderr, Colima daemon logs); menu bar access. It controls tools through the `colima` CLI and optional `docker`/`kubectl`/`limactl`.
  https://github.com/RealDyllon/ColimaStack

## Desktop apps that replace Colima (own runtime)
- **Rancher Desktop** (SUSE, open source): container management plus Kubernetes (k3s) with a GUI; runtime choice Docker or containerd and a Kubernetes version.
  https://setapp.com/app-reviews/docker-desktop-alternatives-for-mac
- **Podman Desktop** (open source): dashboard for containers, images, pods and volumes; registry and network settings; system tray; Kubernetes deploy; extensions (Docker, Kind, Minikaga, Lima, Compose). Its Docker extension auto-registers the socket when a Docker engine is running, so it can show a Colima engine's containers, images and volumes. List features worth learning from: filters on containers and pods, sorting on volumes and images, bulk deletion, an environment column, and a fix that disables create/start when a port is busy.
  https://podman-desktop.io/docs/extensions/install/using-extension
  https://podman-desktop.io/blog/podman-desktop-release-1.6
  https://podman-desktop.io/docs/discover-podman-desktop
- **OrbStack**: not open source (free tier).

## Self-hosted web dashboards (run as containers, mount the Docker socket)
- **Portainer CE**: Docker, Swarm, Kubernetes, Podman, ACI. SSO/OIDC, granular RBAC and some security features are Business Edition only; web-editor stacks live in its database rather than as YAML files.
- **Dockge** (MIT): compose-first, file-first (stacks stay as YAML on disk), web terminal, templates (Nginx, PostgreSQL, MySQL, Redis, MariaDB, MongoDB...), convert `docker run` to compose; a fork adds network and image management.
  https://github.com/mayi/dockge
- **Arcane** (Go, BSD-3): compose-native, GitOps, REST API, container file browser and web terminal, remote hosts. **Dockhand**: security scanning. **Komodo**: build and deploy, GitOps, fleet.
  https://www.bitdoze.com/portainer-alternatives/
  https://landingpage.spot.rackspace.com/blog/portainer-alternatives/

## Terminal UIs
- **lazydocker** (Go): docker and compose state at a glance, logs, restart/remove/rebuild, ASCII metric graphs, pruning containers/images/volumes; `brew install lazydocker`.
  https://github.com/jesseduffield/lazydocker
- **k9s**: fast terminal UI for Kubernetes.

## Kubernetes UIs
- The official Kubernetes Dashboard was archived in 2026; its SIG recommends **Headlamp** (CNCF sandbox, web and desktop, plugins). **Freelens** (MIT) continues OpenLens. **Lens** has been freemium since 2023. Others: Radar UI, Seabird, Spinoza (source-available).
  https://computingforgeeks.com/best-kubernetes-ui-management-tools/
  https://enterno.io/en/s/alternatives-lens

## What none of the feature lists above mention (not proof of absence)
- A container-to-container connectivity doctor, plain-language explanations of why a container or pod is unhealthy with what to check, guided Run with the image's own setup links, and volume-deletion safeguards.

## Scope decision (recorded 2026-11-11)

**Option chosen: narrow to guidance layer + integrations.**

Rationale:
- Mature open-source tools already do compose editing, deep Kubernetes browsing, and keyboard-driven TUIs well (Podman Desktop, Dockge/Arcane, lazydocker, k9s, Headlamp). Rebuilding them is not differentiated.
- This project keeps investing in the **guidance layer** (doctor, plain-language problems, guided Run) and **Colima lifecycle** management — the gaps none of the existing tools cover.
- Integration over rebuilding: open lazydocker and k9s from the app; learn from others (menu bar, diagnostics, command log from ColimaStack; filters/sort/bulk actions and busy-port warnings from Podman Desktop; compose as first-class from Dockge/Arcane).

This decision blocks W2–W10: those workstreams assume either a full roadmap or adoption of an existing tool. With this scope recorded, they can proceed as guidance-layer + integration work only.

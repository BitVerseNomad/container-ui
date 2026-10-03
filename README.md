# Colima UI

A small Tauri desktop app that manages Colima profiles by shelling out to the `colima` CLI.

## Run
Prereqs: Node 18+, Rust (rustup), Colima.

    npm install
    npx tauri icon path/to/any-1024px.png   # one-time, generates src-tauri/icons
    npm run tauri dev

## Build
    npm run tauri build

## Tabs
Containers (start, stop, restart, remove, live logs), Images, Volumes, and Colima profiles.
Needs the Docker CLI (`brew install docker`). The app talks to the docker context Colima creates
for the selected profile (`colima`, or `colima-<profile>`); check with `docker context ls`.

## Pull images and edit profiles
Images tab: "Pull image" searches Docker Hub and streams the pull. Colima tab: "Edit" changes CPU,
memory and disk. Colima applies these on start, so a running profile is stopped first (its containers
stop). Run the Rust unit tests with `cd src-tauri && cargo test`.

## Run images and inspect containers
- Images tab: **Run** opens a panel (name, ports prefilled from the image, volumes, environment).
  mysql, mariadb and postgres prefill the password variable they need to start.
- Pull panel: one-click picks (hello-world, nginx, mysql, ...) and a Run button after the pull.
- Containers tab: click a container for logs, inspect, live stats and mounts, plus
  start/stop/restart/pause/remove and clickable localhost links for published ports.

## Tests
    npm test                      # TypeScript helpers (Node 22.6+)
    cd src-tauri && cargo test    # Rust helpers

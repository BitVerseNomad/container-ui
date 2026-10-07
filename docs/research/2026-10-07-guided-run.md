# Research notes: guided Run (sources checked before design)

Principle for this project: research the official documentation first, link the sources in the UI, and guide the user plainly.
Checked on 2026-10-07. Each fact below is from the linked page, not from memory.

## Containers find each other by name only on a user-defined network
- Docker bridge driver docs: user-defined bridges provide automatic DNS resolution, containers resolve each other by name or alias; on the default bridge they only reach each other by IP.
  https://docs.docker.com/engine/network/drivers/bridge/
- Containers on the same user-defined bridge effectively expose all ports to each other, so a published port is only needed to reach a container from the Mac.
- A network is created with `docker network create`.

## Images document their own required settings, and defaults change between versions
- Docker Official Image `postgres`: the data volume is declared at `/var/lib/postgresql` from version 18; for 17 and below mount at `/var/lib/postgresql/data`; a mount at the wrong path does not persist data. Without a data volume the runtime creates an anonymous volume that is not reused when the container is recreated.
  https://hub.docker.com/_/postgres
- Conclusion: read the volume paths and ports the image itself declares instead of hard-coding per-image rules, and always link the image's own page.

## Where to find an image's own documentation
- OCI image spec annotations (attached to the image config as labels): `org.opencontainers.image.documentation`, `.url`, `.source`, `.title`, `.description`, `.version`, `.vendor`. Legacy equivalents under `org.label-schema.*` (`usage`, `url`, `vcs-url`).
  https://github.com/opencontainers/image-spec/blob/main/annotations.md
- Many images do not set them, so the fallback is the Docker Hub page: `https://hub.docker.com/_/<name>` for official images, `https://hub.docker.com/r/<namespace>/<name>` otherwise.

## Example of why a link beats a guess (not built into the app)
- Docker's Kafka guide shows a broker needs separate host and container listeners, with the container address being the network alias, which is why settings that depend on a container's name must follow the name the user picks.
  https://docs.docker.com/guides/kafka/
- Kafbat UI is the maintained Kafka UI; Provectus has paused development of the original. Not encoded in the app: no per-image rules.

## Not yet researched (do before building each)
- Compose files in repos, private registries (AWS ECR login), prune guidance, image platform and architecture fields.

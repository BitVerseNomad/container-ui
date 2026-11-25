# 0004. One main action per row, and plain words

## Status

Accepted. Written into `AGENTS.md` as the UX rules.

## Context

Container tools show many buttons per row and speak in Docker terms. The target user knows `docker ps` but loses time on "why can't A reach B". The app is meant to explain problems, not expose commands.

## Decision

1. A row or card has one main action, the common one (Start when stopped, Stop when running). The rest go in the row's ⋯ menu.
2. Every menu item has a one-line hint of when to use it.
3. The app runs the command. A command to copy is a last resort.
4. Labels use plain words ("Remove containers", not "Down"; "Folders", not "Mounts"; "Keeps restarting", not "restart loop"). The spec holds the word list.
5. A problem is a tinted line under its row. It states the cause in one sentence and offers one button: a fix, or "See why".
6. A volume row has no main action on purpose: the only action is destructive.

## Consequences

1. Rows stay one line and columns line up.
2. Kubernetes pod containers have no actions in the Containers list, because the cluster owns them.
3. Rules live in [AGENTS.md](../../AGENTS.md) and the details in [ui-principles](../design/ui-principles.md).

Sources: `AGENTS.md` (UX rules 1 to 5), `docs/plan/04-design-spec.md` (sections 1, 6.5, 6.6, 7.1, 7.4, 9) at commit 29b538e.

# Checks waiting for their screen

These browser checks failed when the preview was repaired (WO-0.3), because the screens they test lost their stylesheet. `npm run check` does not run them.

Rules:

1. The work order in the table brings its check back: move it to `scripts/`, make it use `scripts/lib/check.mjs`, the new routes and the new words, and make it pass in Chromium and WebKit.
2. Every behaviour the old check proved must still be proved.
3. This folder may only shrink. It must be empty when iteration 3 ends.

| Check | Brought back by |
|---|---|
| `check-observe.mjs` | WO-3.2 |
| `check-mounts.mjs` | WO-3.2 |
| `check-compose.mjs` | WO-3.3 |
| `check-guided.mjs` | WO-3.3 |
| `check-pull.mjs` | WO-3.3 |
| `check-disk.mjs` | WO-3.4 |
| `check-volumes.mjs` | WO-3.5 |
| `check-network.mjs` | WO-3.6 |
| `check-netfix.mjs` | WO-3.8 (it tests a Doctor fix) |
| `check-k8s.mjs` | WO-3.7 |
| `check-doctor.mjs` | WO-3.8 |
| `check-resize.mjs` | WO-3.9 |
| `check-setup.mjs` | WO-3.10 |
| `check-bring.mjs` | WO-3.11 |
| `check-bring-home.mjs` | WO-3.11 |
| `check-replace.mjs` | WO-3.11 |
| `check-a11y.mjs` | WO-3.11 |
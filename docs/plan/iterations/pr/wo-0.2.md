wo-0.2: the unsafe Lima environments and the AI chat are gone

## What changed

1. The old Projects feature, its Lima VMs and its file and token access are deleted.
2. The AI chat, the Ollama commands and their packages are deleted.
3. The app opens on Containers, and its sidebar has no Projects item.

## Steps done

- [x] Deleted `src-tauri/src/lima.rs`, `src-tauri/src/projects.rs` and `src-tauri/migrations/`.
- [x] Deleted the two `mod` lines in `src-tauri/src/main.rs`.
- [x] Deleted every `lima::`, `projects::` and `ollama_` entry from `generate_handler!`.
- [x] Deleted the three Ollama functions and their now unused structs.
- [x] Built Rust until it printed no warning.
- [x] Replaced `src-tauri/Cargo.toml` with the exact content in the work order.
- [x] Built Rust again: it needed no removed crate back.
- [x] Deleted `src/features/`, `src/ai/`, `src/shared/`, `src/Onboarding.tsx`, `src/hooks/useProjectTerminal.ts`, `src/lib/projectsApi.ts`, `src/lib/projectDetection.ts` and `scripts/native-interaction.test.ts`.
- [x] Uninstalled `xterm`, `@xterm/addon-fit` and `@xterm/addon-webgl`.
- [x] Made the six edits in `src/App.tsx` and the three edits in `src/Shell.tsx`.
- [x] Deleted the `.ai-send:disabled` rule and the onboarding rules from `src/styles.css`.
- [x] Removed `src/hooks/useProjectTerminal.ts` from the ESLint legacy block.
- [x] Ran `npx tsc --noEmit`: no errors.

## Evidence

`ls src-tauri/src`:

```text
desktop.rs
main.rs
setup.rs
```

`grep -rn "fs_read_text_file\|fs_read_dir\|get_gh_token\|GH_TOKEN\|ollama\|lima::\|projects::" src-tauri/src; echo "exit $?"`:

```text
exit 1
```

`grep -rnE "features/projects|useProjectTerminal|projectsApi|projectDetection|xterm|Onboarding|ProjectsPage" src scripts preview package.json`:

```text
src/test/setup.ts:5:// Mock HTMLCanvasElement.getContext for xterm WebGL addon
```

`grep -c "sqlx\|tokio\|uuid\|chrono" src-tauri/Cargo.toml`: `0`

`(cd src-tauri && cargo test 2>&1 | grep "^test result")`:

```text
test result: ok. 135 passed; 0 failed; 2 ignored; 0 measured; 0 filtered out; finished in 3.27s
```

`npm test 2>&1 | grep -E "^# (pass|fail)|Test Files"`:

```text
# pass 586
# fail 0
 Test Files  8 passed (8)
```

Gate:

```text
npm ci          exit 0
npm run lint    exit 0 (0 errors, 33 warnings)
npx tsc --noEmit exit 0
npm test        exit 0 (# pass 586, # fail 0, Tests 79 passed)
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test   exit 0 (135 passed; 0 failed; 2 ignored)
```

## Screenshots

None. The preview does not build until WO-0.3, as the work order says.

## Not done or changed from the work order

1. Deleted the untracked, gitignored `preview/index.html` because it was stale generated output and the done-when search matched it. It is listed in `FOUND.md`. WO-0.3 deletes it too.
2. The pull request title says "unsafe" while the work order's title says "the unsafe Lima environments and the AI chat are gone". The first line above is the work order's exact title.

## Found on the way

- 2026-11-13, `preview/index.html`, a 1.3 MB generated preview page was left on disk by the old bundler. It is untracked and ignored by git, but it still held the deleted Projects and AI code, so the WO-0.2 done-when search matched it. Removed the stale file. WO-0.3 deletes it as part of the new preview.

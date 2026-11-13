# Found on the way

- 2026-11-13, `preview/index.html`, a 1.3 MB generated preview page was left on disk by the old bundler. It is untracked and ignored by git, but it still held the deleted Projects and AI code, so the WO-0.2 done-when search matched it. Removed the stale file. WO-0.3 deletes it as part of the new preview.
- 2026-11-13, `README.md`, the contributor line still points to `docs/SUMMARY.md` and `docs/SPEC.md`, which WO-0.5 step 3 deleted. The step 4 search names only the moved files, so these dead links stay. A new contributor follows them to nothing.
- 2026-11-13, `src/ui/tokens.css`, line 42 names the deleted `Table.css` in a comment. The step 4 rule covers an import line, and this file has no import, so the stale comment stays.

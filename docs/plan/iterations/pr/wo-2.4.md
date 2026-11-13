wo-2.4: One list of shortcuts for the keys, Help and the palette

1. **What changed**: Three lines at most.
- One list of shortcuts (src/lib/shortcuts.ts) now drives the keys, Help and the palette, replacing three disagreeing sources.
- Help (HelpModal.tsx) and Activity (Activity.tsx) open as sheets; the command palette (CommandPalette.tsx + Palette.tsx) searches containers and actions.
- The old CommandLog, Cmd+0/7, Cmd+Shift+A/N and the Portuguese help text are gone.

2. **Steps done**:
- [x] 1. Write the tests first (shortcuts.test.ts, paletteModel.test.ts, Palette.test.tsx, CommandPalette.test.tsx, HelpModal.test.tsx, useKeyboardShortcuts.test.tsx)
- [x] 2. Create src/lib/shortcuts.ts
- [x] 3. Edit src/App.tsx: handlers map, keyboardShortcuts from activeShortcuts, focusPageSearch, Escape listener, palette items builder
- [x] 4. Edit src/hooks/useKeyboardShortcuts.ts: isTypingTarget rule, ? ignores shiftKey, keep preventDefault
- [x] 5. Edit src/hooks.ts: usePoll listens for openpier:refresh
- [x] 6. App.tsx: Escape listener dispatches openpier:escape when no dialog/menu is open
- [x] 7. Create src/lib/paletteModel.ts
- [x] 8. Create src/ui/op/Palette.tsx; rewrite src/CommandPalette.tsx
- [x] 9. App.tsx builds palette items (containers, actions, go-to)
- [x] 10. Rewrite src/HelpModal.tsx as a Sheet with activeShortcuts and LIST_KEYS
- [x] 11. Create src/Activity.tsx; delete CommandLog from Commands.tsx
- [x] 12. Remove from scripts/not-migrated.json: CommandPalette.tsx, HelpModal.tsx
- [x] 13. Create scripts/check-palette.mjs (20 checks)
- [x] 14. Mockup row: none (by eye only; palette, Help, Activity appear after key press or click)

3. **Evidence**:
- `npx tsc --noEmit`: clean (no output)
- `npm run lint`: 0 errors, 36 warnings (pre-existing)
- `npm test`: 215 passed, 48 files
- `node --experimental-strip-types --no-warnings --test src/lib/shortcuts.test.ts src/lib/paletteModel.test.ts`: # fail 0
- `npx vitest run src/ui/op/Palette.test.tsx src/CommandPalette.test.tsx src/HelpModal.test.tsx src/hooks/useKeyboardShortcuts.test.tsx`: 19 passed
- `grep -rn "Cmd+0\|key: \"0\"\|key: \"7\"" src --include=*.ts --include=*.tsx`: nothing outside tests
- `grep -n "Atalhos\|Fechar" src/HelpModal.tsx`: nothing
- `node scripts/check-palette.mjs`: no FAIL (Chromium)
- `PW_ENGINE=webkit node scripts/check-palette.mjs`: no FAIL (WebKit)

4. **Screenshots**: none taken; palette, Help and Activity appear only after a key press or click, compared by eye against command-palette-light.png and command-palette-dark.png at http://localhost:4173/?scenario=design#/containers

5. **Not done or changed from the work order**: nothing

6. **Found on the way**: none (no lines added to FOUND.md)

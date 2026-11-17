// Focus a list row by its name after an action (e.g. a Run that starts a container). Rows are found by name, not id,
// and the row appears only when the list reloads, so this tries for a few seconds, then gives up.
export function focusWhenShown(name: string, tries = 30): void {
  const node = [...document.querySelectorAll<HTMLElement>(".list .row .name")].find((n) => n.textContent === name);
  const row = node?.closest<HTMLElement>(".row");
  if (row) row.focus();
  else if (tries > 0) setTimeout(() => focusWhenShown(name, tries - 1), 100);
}

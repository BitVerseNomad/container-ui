// Where focus should return to when a panel or dialog closes. Chromium focuses a button on mousedown; WebKit (the
// app's WKWebView) does not, so after a mouse click `document.activeElement` is the page body and there is nothing to
// return to. The last pressed control stands in for it, so a mouse user lands back on the button they clicked.
// It is only a control (a press on blank space clears it), it is used once, and a key press clears it.
const CONTROL = 'button, a[href], input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';
let pressed: HTMLElement | null = null;
if (typeof document !== "undefined") {
  document.addEventListener("mousedown", (e) => { pressed = (e.target as Element | null)?.closest?.<HTMLElement>(CONTROL) ?? null; }, true);
  document.addEventListener("keydown", () => { pressed = null; }, true);
}
// The control under the last mouse press, for code that learns of a press only through focus (Doctor's rows).
export const controlAt = (target: EventTarget | null): HTMLElement | null => (target as Element | null)?.closest?.<HTMLElement>(CONTROL) ?? null;
export function openerNow(): HTMLElement | null {
  const at = document.activeElement as HTMLElement | null;
  if (at && at !== document.body) { pressed = null; return at; }
  const p = pressed && pressed.isConnected ? pressed : null;
  pressed = null;
  return p ?? at;
}

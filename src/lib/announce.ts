// A live region that says the same words twice in a row: it is cleared first and set a moment later, because a
// screen reader reads only a change. Each call cancels one still waiting, so the latest words win.
export function announcer(set: (text: string) => void, ms = 50) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (text: string) => {
    if (timer) clearTimeout(timer);
    timer = null;
    set("");
    if (text) timer = setTimeout(() => { timer = null; set(text); }, ms);
  };
}

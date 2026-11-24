// Sets <html data-theme> from the system setting, so the dark tokens in openpier.css apply. Follows later changes too.
export const DARK_QUERY = "(prefers-color-scheme: dark)";

type ThemeQuery = { matches: boolean; addEventListener?: (type: "change", listener: (event: { matches: boolean }) => void) => void };

export function followSystemTheme(target: Pick<HTMLElement, "dataset">, matchMedia: (query: string) => ThemeQuery): void {
  const apply = (dark: boolean) => {
    target.dataset.theme = dark ? "dark" : "light";
  };
  try {
    const query = matchMedia(DARK_QUERY);
    apply(query.matches);
    query.addEventListener?.("change", (event) => apply(event.matches));
  } catch {
    // No matchMedia (or it throws): keep the light tokens, the app's default look.
    apply(false);
  }
}

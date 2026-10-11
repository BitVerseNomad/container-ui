// Only the newest request counts: a slow older answer must not overwrite a newer one.
export function latest() {
  let seq = 0;
  return async function run<T>(fn: () => Promise<T>): Promise<{ current: boolean; ok: boolean; value?: T; error?: unknown }> {
    const mine = ++seq;
    try {
      const value = await fn();
      return { current: mine === seq, ok: true, value };
    } catch (error) {
      return { current: mine === seq, ok: false, error };
    }
  };
}

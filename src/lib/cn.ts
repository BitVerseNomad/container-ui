export function cn(...inputs: (string | undefined | null | false | Record<string, boolean> | undefined)[]) {
  return inputs
    .filter((input): input is string | Record<string, boolean> => Boolean(input))
    .map((input) =>
      typeof input === "string"
        ? input
        : Object.entries(input)
            .filter(([, value]) => value)
            .map(([key]) => key)
            .join(" ")
    )
    .join(" ");
}
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        requestAnimationFrame: "readonly",
        CustomEvent: "readonly",
        EventListener: "readonly",
        Event: "readonly",
        HTMLElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLHeadingElement: "readonly",
        HTMLUListElement: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      // Prevent hardcoded design values outside of tokens.css and ui/components/
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message:
            "Hardcoded hex colors are not allowed. Use CSS variables from tokens.css (e.g., --color-accent) or Tailwind arbitrary values (bg-[var(--color-accent)]).",
        },
        {
          selector: "Literal[value=/^\\d+px$/]",
          message:
            "Hardcoded pixel values are not allowed. Use spacing scale from tokens.css (space-xs/sm/md/lg/xl/2xl) or Tailwind spacing classes.",
        },
      ],
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];

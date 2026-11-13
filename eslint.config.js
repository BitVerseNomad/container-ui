import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

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
      "react-hooks": reactHooks,
    },
    rules: {
      // Colours and sizes live in the stylesheet, never in a component.
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "Hardcoded hex colors are not allowed. Use a class from the stylesheet.",
        },
        {
          selector: "Literal[value=/^\\d+px$/]",
          message: "Hardcoded pixel values are not allowed. Use a class from the stylesheet.",
        },
      ],
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Tests may name colours and sizes: they assert on them.
    files: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/test/**"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Legacy files with hardcoded values. Each is deleted by a later work order; do not add to this list.
    files: ["src/ui/Skeleton.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
];

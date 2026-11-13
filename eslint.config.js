import fs from "node:fs";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";

const notMigrated = JSON.parse(fs.readFileSync(new URL("./scripts/not-migrated.json", import.meta.url), "utf8"));

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
  {
    // Screens are built from src/ui/op. Files still on the old components are in scripts/not-migrated.json.
    files: ["src/**/*.tsx"],
    ignores: ["src/ui/op/**", "src/**/*.test.tsx", ...notMigrated],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["**/ui", "**/ui/index", "**/ui/ui", "**/ui/components", "**/ui/components/*", "**/ui/icons", "**/ui/Button", "**/ui/Card", "**/ui/Dialog", "**/ui/Menu", "**/ui/Input", "**/ui/Select", "**/ui/Drawer", "**/ui/Badge", "**/ui/Skeleton", "**/ui/Spinner", "**/ui/PageHeader", "**/ui/Status"], message: "Use the components in src/ui/op." },
        { group: ["lucide-react"], message: "Use <Icon> from src/ui/op." },
      ] }],
      "no-restricted-syntax": ["error",
        { selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]", message: "No colours in components. Use a class from the stylesheet." },
        { selector: "Literal[value=/^\\d+px$/]", message: "No pixel values in components. Use a class from the stylesheet." },
        { selector: "JSXOpeningElement[name.name='button']", message: "Use <Button> from src/ui/op." },
        { selector: "JSXOpeningElement[name.name='select']", message: "Use <Select> from src/ui/op." },
        { selector: "JSXOpeningElement[name.name='table']", message: "Use <List> and <Row> from src/ui/op." },
        { selector: "JSXAttribute[name.name='style']", message: "No inline styles. Use a class from the stylesheet." },
      ],
    },
  },
  {
    // The one inline style in the design system: the meter's fill is a CSS variable.
    files: ["src/ui/op/Meters.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
];

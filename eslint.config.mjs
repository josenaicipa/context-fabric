// ESLint flat config for the public repo: TypeScript sources/tests/templates
// plus the plain-JS scripts. Generated output (dist/) is never linted.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const nodeGlobals = {
  console: "readonly",
  process: "readonly",
  Buffer: "readonly",
  URL: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
};

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "artifacts/**", "coverage/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: nodeGlobals },
  },
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);

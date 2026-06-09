// Flat ESLint config (ESLint v9+/v10).
// Mirrors the intent of the legacy .eslintrc: @typescript-eslint recommended
// rules + Prettier compatibility (eslint-config-prettier disables formatting
// rules that would conflict with Prettier).
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const prettierConfig = require("eslint-config-prettier");

module.exports = [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      // Pre-existing technical debt in app code: surfaced as warnings so the
      // lint step reports them without blocking the pipeline.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Test files use loose typing/mocks; relax the corresponding rules.
    files: ["src/**/__tests__/**/*.ts", "src/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];

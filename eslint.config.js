import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Node scripts (dev environment): no extra `globals` dependency, just the ones used.
    files: ["dev/**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", fetch: "readonly", console: "readonly", setTimeout: "readonly", URLSearchParams: "readonly", WebSocket: "readonly" },
    },
  },
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
);

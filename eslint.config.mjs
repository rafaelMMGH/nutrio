import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const eslintConfig = [
  {
    ignores: [
      ".next*/**",
      "src/generated/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "data/**",
      ".agents/**",
      ".claude/**",
      ".codex/**",
      ".idea/**",
      ".impeccable/**",
      "public/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Next ships these as warnings, which bulk suppressions ignore. Errors make the
    // baseline in eslint-suppressions.json cover them, so new violations fail lint.
    rules: {
      "@next/next/no-img-element": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-unused-expressions": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
];

export default eslintConfig;

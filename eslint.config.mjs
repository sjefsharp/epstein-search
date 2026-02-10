import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import security from "eslint-plugin-security";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  {
    ignores: [
      // Default ignores of eslint-config-next:
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "worker/dist/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    plugins: {
      security,
    },
    rules: {
      "no-console": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "security/detect-object-injection": "warn",
      "security/detect-unsafe-regex": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-new-buffer": "error",
      "security/detect-child-process": "warn",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-non-literal-regexp": "warn",
    },
  },
  prettier,
];

export default eslintConfig;

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importX from "eslint-plugin-import-x";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Editor-time mirror of the import-boundary law (Charter §1.1). The
  // comprehensive law lives in lib/verification/import-boundaries.test.ts; this
  // gives fast feedback in the IDE. import-x is configured standalone (its
  // `import-x/*` rule namespace does not collide with the legacy `import/*`
  // rules that eslint-config-next registers internally).
  {
    plugins: { "import-x": importX },
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./lib",
              from: "./app",
              message: "Foundation must not import features (Charter §1.1)",
            },
          ],
        },
      ],
    },
  },
  {
    // lib/registry/ is the sanctioned bridge to feature manifests.
    files: ["lib/registry/**"],
    rules: {
      "import-x/no-restricted-paths": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

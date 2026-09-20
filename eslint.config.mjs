import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat config. The `lint` script used to be `next lint`, which Next 16
 * removed — it silently read "lint" as a directory name and failed with
 * "Invalid project directory" on every run, so this project had no working
 * linter at all for a while. `eslint .` replaces it.
 *
 * Only `src/` is linted: `engine/` is plain Node ESM with its own shape, the
 * two Android modules are Kotlin, and the rest is build output.
 */
export default [
  {
    ignores: [
      "**/node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "engine/**",
      "android-tv-nx/**",
      "android-mobile-nx/**",
      "packaging/**",
      "scripts/**",
      "public/**",
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
];

import { fileURLToPath } from "node:url";

const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    [fileURLToPath(new URL("./scripts/postcss-desktop-text-scale.cjs", import.meta.url))]: {},
  },
};

export default config;

import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    target: "node22",
    outDir: "dist",
    clean: true,
    sourcemap: true,
    dts: false,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    entry: ["src/api.ts"],
    format: ["esm"],
    target: "node22",
    outDir: "dist",
    sourcemap: true,
    dts: false,
  },
]);

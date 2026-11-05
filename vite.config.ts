import { readFileSync } from "node:fs";
import { defineConfig } from "vite";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

// Single self-contained ES module: dist/ha-forecast-card.js (Lit bundled, no runtime fetches).
export default defineConfig({
  define: { __VERSION__: JSON.stringify(version) },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: "src/ha-forecast-card.ts",
      formats: ["es"],
      fileName: () => "ha-forecast-card.js",
    },
  },
  server: {
    port: 5000,
    cors: true,
  },
});

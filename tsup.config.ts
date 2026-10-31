import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  outDir: "dist",
  minify: true,
  dts: false,
  sourcemap: true,
  treeshake: true,
  clean: true,
});

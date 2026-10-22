import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import flattenOutput from "vite-plugin-flatten-output";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    flattenOutput({
      removeDirs: ["src/pages/option", "src/pages/popup"],
      filePattern: ".html",
    }),
  ],

  build: {
    rolldownOptions: {
      input: {
        popup: fileURLToPath(new URL("./src/pages/popup/popup.html", import.meta.url)),
        nested: fileURLToPath(new URL("./src/pages/option/option.html", import.meta.url)),
        content: fileURLToPath(new URL("./src/content.ts", import.meta.url)),
        background: fileURLToPath(new URL("./src/background.ts", import.meta.url)),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "content") return "content.js";
          if (chunkInfo.name === "background") return "background.js";
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import removeDirsFromPath from "vite-plugin-remove-dirs-from-path";

export default defineConfig({
  plugins: [
    react(),
    removeDirsFromPath({
      removeDirs: ["src/pages/option", "src/pages/popup"],
      filePattern: ".html",
    }),
  ],

  build: {
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, "src/pages/popup/popup.html"),
        nested: path.resolve(__dirname, "src/pages/option/option.html"),
        content: path.resolve(__dirname, "src/content.ts"),
        background: path.resolve(__dirname, "src/background.ts"),
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

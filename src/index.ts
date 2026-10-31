import { stat } from "node:fs/promises";
import { posix, resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite" with { "resolution-mode": "import" };
import { rebaseHtml } from "./rebase-html";

export interface FlattenOutputOptions {
  removeDirs: string[];
  filePattern?: string;
}

function normalizeDirectory(directory: string): string {
  const normalized = posix.normalize(directory.replace(/\\/g, "/"));
  if (normalized === "." || normalized === ".." || normalized.startsWith("../") || normalized.startsWith("/") || /^[a-z]:/i.test(normalized)) {
    throw new Error(`removeDirs must contain relative, non-empty directories: ${directory}`);
  }
  return normalized.replace(/\/$/, "");
}

export default function flattenOutput(options: FlattenOutputOptions): Plugin {
  if (!options || !Array.isArray(options.removeDirs) || options.removeDirs.some((dir) => typeof dir !== "string" || !dir)) {
    throw new Error("removeDirs must be an array of non-empty directory strings");
  }
  const directories = [...new Set(options.removeDirs.map(normalizeDirectory))].sort((a, b) => b.length - a.length);
  const pattern = options.filePattern ?? ".html";
  if (typeof pattern !== "string" || !pattern) throw new Error("filePattern must be a non-empty literal suffix");
  let config: ResolvedConfig;

  return {
    name: "vite-plugin-flatten-output",
    apply: "build",
    enforce: "post",
    configResolved(resolved) {
      config = resolved;
    },
    async generateBundle(_, bundle) {
      const renames = new Map<string, string>();
      const destinations = new Map<string, string>();
      const items = Object.values(bundle);
      for (const item of items) {
        const directory = directories.find((dir) => item.fileName.startsWith(`${dir}/`));
        if (!directory || !item.fileName.endsWith(pattern)) continue;
        if (item.type === "chunk" || /\.(?:css|m?js|cjs|map)$/i.test(item.fileName)) {
          this.error(`Cannot safely flatten code output "${item.fileName}". Use Vite output naming options for JavaScript, CSS, and sourcemaps.`);
        }
        const destination = item.fileName.slice(directory.length + 1);
        renames.set(item.fileName, destination);
        const previous = destinations.get(destination);
        if (previous) this.error(`Flatten output collision: "${previous}" and "${item.fileName}" both produce "${destination}"`);
        destinations.set(destination, item.fileName);
      }
      for (const [source, destination] of renames) {
        if (bundle[destination] && !renames.has(destination)) this.error(`Flatten output collision: "${source}" would overwrite "${destination}"`);
        if (config.publicDir && config.build.copyPublicDir) {
          const publicFile = await stat(resolve(config.publicDir, destination)).catch((error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT" || error.code === "ENOTDIR") return undefined;
            throw error;
          });
          if (publicFile) this.error(`Flatten output collision: "${source}" would overwrite public file "${destination}"`);
        }
      }
      if (!renames.size) return;
      const replacements = items.filter((item) => renames.has(item.fileName) || (item.type === "asset" && /\.html?$/i.test(item.fileName)));
      const emitted = replacements.map((item) => {
        if (item.type !== "asset") return undefined;
        const fileName = renames.get(item.fileName) ?? item.fileName;
        const source = /\.html?$/i.test(item.fileName)
          ? rebaseHtml(typeof item.source === "string" ? item.source : Buffer.from(item.source).toString("utf8"), item.fileName, fileName, renames)
          : item.source;
        return { item, oldName: item.fileName, fileName, source };
      });
      for (const item of emitted) {
        if (item && item.oldName !== item.fileName) delete bundle[item.oldName];
      }
      for (const item of emitted) {
        if (!item) continue;
        if (item.oldName === item.fileName) item.item.source = item.source;
        else this.emitFile({ type: "asset", fileName: item.fileName, source: item.source });
      }
    },
  };
}

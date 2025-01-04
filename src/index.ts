import type { Plugin } from "vite";

/**
 * Options for the FlattenOutput plugin.
 * @interface FlattenOutputOptions
 * @property {string[]} removeDirs - An array of directory paths to remove from the file names.
 * @property {string} filePattern - The file pattern to match against (e.g., ".html").
 */
interface FlattenOutputOptions {
  removeDirs: string[];
  filePattern: string;
}

/**
 * A Vite plugin to remove specified directories from output file paths.
 * @param {FlattenOutputOptions} options - Configuration options for the plugin.
 * @returns {Plugin} A Vite plugin instance.
 */
export default function flattenOutput(options: FlattenOutputOptions): Plugin {
  const { removeDirs, filePattern } = options;

  const dirsPattern = new RegExp(
    `^(${removeDirs.join("|")})/.*\\${filePattern}$`
  );

  return {
    name: "vite-plugin-flatten-output",
    enforce: "post",
    generateBundle(_, bundle) {
      for (const outputItem of Object.values(bundle)) {
        if (
          typeof outputItem === "object" &&
          outputItem.fileName &&
          dirsPattern.test(outputItem.fileName)
        ) {
          removeDirs.forEach((removeDir) => {
            outputItem.fileName = outputItem.fileName.replace(
              `${removeDir}/`,
              ""
            );
          });
        }
      }
    },
  };
}

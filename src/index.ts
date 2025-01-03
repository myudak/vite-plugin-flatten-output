import type { Plugin } from "vite";

/**
 * Options for the removeDirsFromPathPlugin.
 * @interface RemoveDirsPluginOptions
 * @property {string[]} [removeDirs] - An array of directory paths to remove from the file names.
 * @property {string} [filePattern] - The file pattern to match against.
 */
interface RemoveDirsPluginOptions {
  removeDirs: string[];
  filePattern: string;
}

/**
 * Vite plugin to remove specified directories from output file paths.
 * @param {RemoveDirsPluginOptions} options - Options for configuring the plugin.
 * @returns {Plugin} The Vite plugin instance.
 */
export default function removeDirsFromPath(
  options: RemoveDirsPluginOptions
): Plugin {
  const { removeDirs, filePattern } = options;

  const dirsPattern = new RegExp(
    `^(${removeDirs.join("|")})/.*\\${filePattern}$`
  );

  return {
    name: "remove-dirs-from-path",
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
              removeDir + "/",
              ""
            );
          });
        }
      }
    },
  };
}

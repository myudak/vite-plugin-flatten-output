# vite-plugin-flatten-output

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> **NOTE**: This plugin is particularly useful for multi-page applications or browser extension projects.

`vite-plugin-flatten-output` is a small Vite plugin designed to simplify your build output by removing specified directories from the file paths. It’s perfect for cases where you want a clean and flat folder structure in your final output.

---

## 🔧 **Problem**

For example, your source folder structure might look like this:

```
├── public
│   ├── manifest.json
└── src
    ├── background.ts
    ├── content.ts
    └── pages
        ├── option.html
        └── popup.html
```

When you build with Vite, the resulting `dist/` folder structure is:

```
dist
 ├── [...bunch of js files]
 └── src/
    └── pages
        ├── option.html
        └── popup.html
```

### 🛠️ Ideal Output

Using this plugin, the final folder structure will look like this:

```
dist
 ├── [...bunch of js files]
 ├── popup.html
 ├── option.html
```

---

## 🚀 **Installation**

Install the plugin using your favorite package manager:

### npm:

```bash
npm install vite-plugin-flatten-output --save-dev
```

### yarn:

```bash
yarn add vite-plugin-flatten-output --dev
```

### pnpm:

```bash
pnpm add vite-plugin-flatten-output --save-dev
```

---

## ⚙️ **Usage**

Add the plugin to your `vite.config.js` (or `vite.config.ts`):

```javascript
import flattenOutput from "vite-plugin-flatten-output";

export default {
  plugins: [
    flattenOutput({
      removeDirs: ["src/pages/option", "src/pages/popup"], // Specify directories to remove
      filePattern: ".html", // Match files by pattern (e.g., '.html')
    }),
  ],
};
```

---

## 🔍 **Options**

### `removeDirs`

- **Type:** `string[]`
- **Description:** An array of directory paths to remove from the output file paths.
- **Example:**
  ```javascript
  removeDirs: ["src/pages/option", "src/pages/popup"];
  ```

### `filePattern`

- **Type:** `string`
- **Default:** `".html"`
- **Description:** The file extension or pattern to match files for removal.
- **Example:**
  ```javascript
  filePattern: ".html";
  ```

---

## 🛠️ **Use Cases**

### 1. **Multi-page Applications**

- Simplify your output structure by flattening HTML files in multi-page setups.

### 2. **Browser Extensions**

- Clean up build outputs for Chrome/Firefox extensions, making it easier to reference HTML files like `popup.html` or `options.html`.

---

## 📄 **License**

This project is licensed under the [MIT License](LICENSE).

---

## 📝 **Contributing**

Feel free to submit issues or pull requests to improve the plugin!

---

## 📦 **Changelog**

See the [CHANGELOG](CHANGELOG.md) for details about updates and changes.

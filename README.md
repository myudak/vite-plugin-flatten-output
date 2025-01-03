# vite-remove-dirs-plugin

A Vite plugin to modify output file paths by removing specified directories. Ideal for building extension

TODO

## Installation

```bash
npm install vite-plugin-remove-dirs -D
```

## Usage

```javascript
import removeDirsFromPath from "vite-plugin-remove-dir-from-path";

export default {
  plugins: [
    removeDirsFromPath({
      removeDirs: ["src/pages/popup", "src/pages/option"],
      filePattern: ".html",
    }),
  ],
};
```

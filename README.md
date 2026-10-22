# vite-plugin-flatten-output

Move nested HTML build output to a shorter path while keeping its relative asset URLs working. Useful for multi-page applications and browser extension popup/options pages.

```text
src/pages/popup/popup.html  →  dist/popup.html
src/pages/option/option.html  →  dist/option.html
```

Supports Vite 5.1+, 6, 7, and 8, including Vite 8's Rolldown build pipeline. Use a Node.js version supported by your Vite version. Development and CI use Node 22.12+ or 24; CI also checks Vite 8 on Node 20.19.

## Install

```sh
npm install -D vite-plugin-flatten-output
```

## Usage

Vite 8:

```ts
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import flattenOutput from 'vite-plugin-flatten-output';

export default defineConfig({
  base: './',
  plugins: [
    flattenOutput({
      removeDirs: ['src/pages/popup', 'src/pages/option'],
    }),
  ],
  build: {
    rolldownOptions: {
      input: {
        popup: resolve('src/pages/popup/popup.html'),
        option: resolve('src/pages/option/option.html'),
      },
    },
  },
});
```

For Vite 5–7, use `build.rollupOptions` instead of `build.rolldownOptions`.

The generated JavaScript, CSS, and images stay in their Vite output locations. The plugin updates relative URLs in HTML to resolve from its new location, including module scripts, stylesheets, preload links, images, `srcset`, and inline CSS `url()`. It also updates relative links to other HTML files moved in the same bundle. Absolute, root-relative, data, and fragment URLs retain their meaning and are left unchanged. A document's `<base href>` is rebased instead of rebasing every URL under it.

Only build output is changed. Development server routes stay the same.

## Options

| Option | Type | Default | Behavior |
| --- | --- | --- | --- |
| `removeDirs` | `string[]` | Required | Literal directory prefixes relative to the output root. |
| `filePattern` | `string` | `'.html'` | Literal filename suffix; not a regular expression or glob. |

Directories with `.` or `+` are matched literally. Leading `./`, trailing slashes, and Windows separators are normalized. The longest matching prefix is removed once; nested directories after that prefix are preserved. An empty array changes nothing. Absolute paths, parent traversal outside the output root, and empty directories are rejected.

If two files would have the same destination, or a moved file would overwrite existing bundle output or a copied public file, the build fails with an error naming the conflicting files.

## Scope and migration

The existing default import and options object are retained. `filePattern` is now optional, matching the previously documented default.

Non-code assets can be moved with another suffix, such as `.txt`. Relative references in HTML are updated when their destination is also moved. Files copied from `public/` are not renamed or rewritten, so an extension manifest should already reference `popup.html` and `option.html`.

JavaScript chunks, CSS, and sourcemaps cannot safely be flattened by renaming after bundling: their imports, source maps, and hashes can become inconsistent. Matching those files now fails with an actionable error. Configure Vite's `output.entryFileNames`, `chunkFileNames`, or `assetFileNames` instead.

The plugin does not rewrite URLs embedded in JavaScript strings, root-relative navigation links to moved pages, external files, or other plugins' custom metadata. Configure those references explicitly.

ES modules and CommonJS are both supported. TypeScript declarations require TypeScript 5.3+ so CommonJS consumers resolve Vite's ESM types correctly:

```js
import flattenOutput from 'vite-plugin-flatten-output';
```

```js
const flattenOutput = require('vite-plugin-flatten-output');
```

## Development and verification

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:browser
pnpm test:compat 8 --browser
```

`pnpm test` runs real Vite builds and regression tests. Browser tests serve the actual output without SPA fallback, open both pages in Chromium, check rendered UI, CSS and images, exercise a dynamic import, and fail on HTTP errors or runtime exceptions.

`pnpm test:compat` uses the pinned npm 11.9 consumer installer (avoiding npm 10 peer-resolution crashes), builds and packs this package, installs the tarball in isolated consumer projects, and runs the same tests there. It also checks ESM/CommonJS Vite config loading, both TypeScript entrypoints, and the published file list. Add `--browser` to include Chromium. Without a version argument it checks `5.1.0`, latest 5, `6.0.0`, latest 6, `7.0.0`, latest 7, `8.0.0`, and latest 8. Exact resolved versions and results are saved in `.test-results/compat.json`.

CI runs that minimum/latest matrix on Node 22.12 and 24, plus Vite 8 on Node 20.19 and a Windows smoke job. CI uses the Chrome browser already installed on GitHub runners; local runs use Playwright's Chromium by default. Each consumer must pass the build, type, config, and browser checks. Release automation depends on the entire CI workflow succeeding.

To run the [extension example](example):

```sh
pnpm build
pnpm --dir example install --frozen-lockfile
pnpm --dir example build
```

See [the test fixtures](tests) and [CI workflow](.github/workflows/main.yml) for the exact checks.

## License

[MIT](LICENSE)

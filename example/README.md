# Extension example

This React + TypeScript example builds popup and options pages with Vite 8 and the local `vite-plugin-flatten-output` package.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --dir example install --frozen-lockfile
pnpm --dir example build
```

Expected files in `example/dist/`:

- `popup.html`
- `option.html`
- `background.js`
- `content.js`
- `manifest.json`
- `assets/` containing generated JavaScript, CSS, and images

Load `example/dist` as an unpacked extension in Chromium. The action opens the popup; the extension options open `option.html`. The content script runs only on `https://example.com/*`.

`base: './'` keeps generated asset URLs relative to the extension pages. The plugin rebases those URLs when moving the HTML files.

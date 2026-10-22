---
"vite-plugin-flatten-output": minor
---

Support Vite 5–8, including Vite 8's Rolldown build pipeline, with real build, packed-consumer, type, and Chromium tests.

Fix relative HTML asset URLs after relocation, implement the documented `.html` default, normalize literal directory prefixes, and fail clearly on output or public-file collisions. Re-emit assets through the bundler API so later plugins see their final filenames.

Code output (JavaScript, CSS, and sourcemaps) now fails with an actionable error instead of being renamed with broken references. Use Vite's output naming options for those files. HTML and non-code assets retain the existing options API.

Add conditional ESM/CommonJS exports and update the extension example to use this package.

import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, extname, sep } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { build, version } from 'vite';
import flattenOutput from 'vite-plugin-flatten-output';

export { build, version, flattenOutput };
export const bundlerOptions = Number(version.split('.')[0]) >= 8 ? 'rolldownOptions' : 'rollupOptions';

export async function writeFiles(root, files) {
  for (const [file, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), content);
  }
}

export async function project(t, files) {
  const root = await mkdtemp(join(tmpdir(), 'flatten-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFiles(root, files);
  return root;
}

export async function runBuild(root, { inputs, options = { removeDirs: ['src/pages/popup', 'src/pages/option'] }, base = './', extra = {}, plugins = [], write = true } = {}) {
  return build({
    root, configFile: false, base, logLevel: 'silent',
    plugins: [flattenOutput(options), ...plugins],
    build: { write, assetsInlineLimit: 0, manifest: true, [bundlerOptions]: { input: Object.fromEntries(inputs.map((input, i) => [`entry${i}`, resolve(root, input)])) }, ...extra },
  });
}

export async function filesIn(root, prefix = '') {
  const result = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    result.push(...(entry.isDirectory() ? await filesIn(root, path) : [path]));
  }
  return result.sort();
}

export const appFiles = {
  'src/pages/popup/popup.html': '<!doctype html><html><head><title>Popup</title></head><body><h1>Popup</h1><button id="load">Load</button><p id="status">waiting</p><img id="image" src="../../logo.svg"><script type="module" src="../../main.js"></script></body></html>',
  'src/pages/option/option.html': '<!doctype html><html><head><title>Options</title></head><body><h1>Options</h1><button id="load">Load</button><p id="status">waiting</p><img id="image" src="../../logo.svg"><script type="module" src="../../main.js"></script></body></html>',
  'src/main.js': 'import "./style.css"; document.body.dataset.ready="yes";document.querySelector("#load").onclick=async()=>{const {message}=await import("./lazy.js");document.querySelector("#status").textContent=message};',
  'src/lazy.js': 'export const message="dynamic loaded";',
  'src/style.css': 'h1{color:rgb(12,34,56)}body{background-image:url(./logo.svg)}',
  'src/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="green"/></svg>',
  'public/manifest.json': JSON.stringify({ manifest_version: 3, name: 'Flatten fixture', version: '1.0.0', action: { default_popup: 'popup.html' }, options_page: 'option.html' }),
};
export const appInputs = ['src/pages/popup/popup.html', 'src/pages/option/option.html'];

export async function staticServer(root, base = '/') {
  const prefix = base.startsWith('/') ? base : '/';
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!path.startsWith(prefix)) { res.writeHead(404).end(); return; }
      const file = resolve(root, path.slice(prefix.length));
      if (!file.startsWith(resolve(root) + sep)) { res.writeHead(403).end(); return; }
      const content = await readFile(file);
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
      res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
      res.end(content);
    } catch { res.writeHead(404).end(); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { url: `http://127.0.0.1:${server.address().port}${prefix}`, close: () => new Promise((done) => { server.close(done); server.closeAllConnections(); }) };
}

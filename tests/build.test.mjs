import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'parse5';
import { project, runBuild, filesIn, appFiles, appInputs, flattenOutput, version } from './helpers.mjs';

for (const base of ['/', './', '', '/demo/']) {
  test(`Vite ${version}: real MPA build with base ${JSON.stringify(base)}`, async (t) => {
    const root = await project(t, appFiles);
    await runBuild(root, { inputs: appInputs, base });
    const files = await filesIn(join(root, 'dist'));
    assert.ok(files.includes('popup.html'));
    assert.ok(files.includes('option.html'));
    assert.ok(!files.some((file) => file.startsWith('src/pages/')));
    const manifest = JSON.parse(await readFile(join(root, 'dist/manifest.json'), 'utf8'));
    for (const file of [manifest.action.default_popup, manifest.options_page]) assert.ok(files.includes(file));
    const buildManifest = JSON.parse(await readFile(join(root, 'dist/.vite/manifest.json'), 'utf8'));
    for (const entry of Object.values(buildManifest)) for (const file of [entry.file, ...entry.css ?? [], ...entry.assets ?? []]) assert.ok(files.includes(file), file);
    for (const page of ['popup.html', 'option.html']) {
      const html = parse(await readFile(join(root, 'dist', page), 'utf8'));
      const urls = [];
      const walk = (node) => {
        for (const attr of node.attrs ?? []) if (['src', 'href'].includes(attr.name)) urls.push(attr.value);
        node.childNodes?.forEach(walk);
      };
      walk(html);
      assert.ok(urls.some((url) => url.endsWith('.js')));
      assert.ok(urls.some((url) => url.endsWith('.css')));
      assert.ok(urls.some((url) => url.endsWith('.svg')));
      for (const url of urls) {
        const path = new URL(url, `http://fixture${base.startsWith('/') ? base : '/'}${page}`).pathname;
        const output = base.startsWith('/') ? path.slice(base.length) : path.slice(1);
        assert.ok(files.includes(decodeURI(output)), `${page}: missing ${url}`);
      }
    }
  });
}

test('write:false exposes only new HTML filenames to later hooks', async (t) => {
  const root = await project(t, appFiles);
  let names;
  const result = await runBuild(root, { inputs: appInputs, write: false, plugins: [{ name: 'inspect-output', enforce: 'post', generateBundle: { order: 'post', handler(_, bundle) { names = Object.keys(bundle); } } }] });
  assert.ok(names.includes('popup.html'));
  assert.ok(!names.includes(appInputs[0]));
  assert.ok(result.output.some((item) => item.fileName === 'popup.html'));
});

test('empty removeDirs is a no-op; repeated builds produce identical files', async (t) => {
  const root = await project(t, appFiles);
  await runBuild(root, { inputs: appInputs, options: { removeDirs: [] } });
  assert.ok((await filesIn(join(root, 'dist'))).includes(appInputs[0]));
  await runBuild(root, { inputs: appInputs });
  const first = await filesIn(join(root, 'dist'));
  const content = await readFile(join(root, 'dist/popup.html'), 'utf8');
  await runBuild(root, { inputs: appInputs });
  assert.deepEqual(await filesIn(join(root, 'dist')), first);
  assert.equal(await readFile(join(root, 'dist/popup.html'), 'utf8'), content);
});

test('literal directory matching, path boundaries, longest prefix and Windows separators', async (t) => {
  const files = Object.fromEntries(['src/a.b+/deep/one.html', 'src/axb+/two.html', 'src/a.b+extra/three.html', 'src/other/four.html'].map((file) => [file, '<h1>fixture</h1>']));
  const root = await project(t, files);
  await runBuild(root, { inputs: Object.keys(files), options: { removeDirs: ['./src\\a.b+\\', 'src/a.b+/deep'] } });
  const output = await filesIn(join(root, 'dist'));
  for (const file of ['one.html', 'src/axb+/two.html', 'src/a.b+extra/three.html', 'src/other/four.html']) assert.ok(output.includes(file), file);
});

test('filePattern is a literal suffix and unmatched HTML stays put', async (t) => {
  const root = await project(t, { 'src/pages/one.html': '<h1>one</h1>', 'src/pages/two.html': '<h1>two</h1>' });
  await runBuild(root, { inputs: ['src/pages/one.html', 'src/pages/two.html'], options: { removeDirs: ['src/pages'], filePattern: 'one.html' } });
  assert.ok((await filesIn(join(root, 'dist'))).includes('one.html'));
  assert.ok((await filesIn(join(root, 'dist'))).includes('src/pages/two.html'));
});

for (const collision of ['two moved pages', 'unchanged output', 'public file']) {
  test(`fails clearly on collision with ${collision}`, async (t) => {
    const files = { 'src/a/popup.html': '<h1>a</h1>' };
    const inputs = ['src/a/popup.html'];
    if (collision === 'two moved pages') { files['src/b/popup.html'] = '<h1>b</h1>'; inputs.push('src/b/popup.html'); }
    if (collision === 'unchanged output') { files['popup.html'] = '<h1>root</h1>'; inputs.push('popup.html'); }
    if (collision === 'public file') files['public/popup.html'] = '<h1>public</h1>';
    const root = await project(t, files);
    await assert.rejects(runBuild(root, { inputs, options: { removeDirs: ['src/a', 'src/b'] } }), /collision.*popup\.html/i);
  });
}

test('copyPublicDir:false ignores public collisions', async (t) => {
  const root = await project(t, { 'src/a/popup.html': '<h1>app</h1>', 'public/popup.html': '<h1>public</h1>' });
  await runBuild(root, { inputs: ['src/a/popup.html'], options: { removeDirs: ['src/a'] }, extra: { copyPublicDir: false } });
  assert.match(await readFile(join(root, 'dist/popup.html'), 'utf8'), /app/);
});

test('does not rewrite arbitrary JavaScript chunks', async (t) => {
  const root = await project(t, { 'src/main.js': 'document.body.textContent="hello"' });
  const emitter = { name: 'nested-chunk', generateBundle(_, bundle) { for (const item of Object.values(bundle)) if (item.type === 'chunk') item.fileName = 'nested/main.js'; } };
  await assert.rejects(runBuild(root, { inputs: ['src/main.js'], options: { removeDirs: ['nested'], filePattern: '.js' }, plugins: [emitter] }), /Cannot safely flatten code output/);
});

test('non-code assets use the same literal path and collision rules', async (t) => {
  const root = await project(t, { 'index.html': '<h1>app</h1>' });
  const emitter = { name: 'text-assets', generateBundle() { this.emitFile({ type: 'asset', fileName: 'nested/info.txt', source: 'hello' }); } };
  await runBuild(root, { inputs: ['index.html'], options: { removeDirs: ['nested'], filePattern: '.txt' }, plugins: [emitter] });
  assert.equal(await readFile(join(root, 'dist/info.txt'), 'utf8'), 'hello');
});

test('validates options and applies only to builds', () => {
  assert.equal(flattenOutput({ removeDirs: [] }).apply, 'build');
  for (const removeDirs of [undefined, 'src', [''], ['/src'], ['../src'], ['.'], ['C:\\src']]) assert.throws(() => flattenOutput({ removeDirs }), /removeDirs/);
  assert.throws(() => flattenOutput({ removeDirs: [], filePattern: '' }), /filePattern/);
});

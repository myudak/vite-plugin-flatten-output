import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'parse5';
import { project, runBuild } from './helpers.mjs';

function attributes(html) {
  const result = new Map();
  const visit = (node) => {
    const attrs = Object.fromEntries((node.attrs ?? []).map((attr) => [attr.name, attr.value]));
    if (attrs.id) result.set(attrs.id, attrs);
    node.childNodes?.forEach(visit);
    if (node.content) visit(node.content);
  };
  visit(parse(html));
  return result;
}

async function emittedHtml(t, source, other = {}, options = {}) {
  const root = await project(t, { 'index.html': '<h1>app</h1>' });
  const emitter = { name: 'html-fixtures', generateBundle() {
    for (const [fileName, html] of Object.entries({ 'src/pages/popup/popup.html': source, ...other })) this.emitFile({ type: 'asset', fileName, source: html });
  } };
  await runBuild(root, { inputs: ['index.html'], plugins: [emitter], ...options });
  return { root, html: await readFile(join(root, 'dist/popup.html'), 'utf8') };
}

test('rebases HTML URLs, srcset, inline CSS, templates, and links between moved pages', async (t) => {
  const { root, html } = await emittedHtml(t, `<!doctype html><html><head>
<style>.picture{background:url('../../../media/bg.svg')} .data{background:url(data:image/png;base64,AAAA)}</style>
</head><body>
<img id="plain" src="../../../media/a%20b.svg?x=1&amp;y=2#icon">
<img id="set" srcset="../../../media/small.svg 1x, ../../../media/large.svg 2x">
<img id="data-set" srcset="data:image/png;base64,AAAA 1x, ../../../media/large.svg 2x">
<div id="css" style="background-image:url('../../../media/bg.svg')"></div>
<a id="sibling" href="../option/option.html?tab=1#top">options</a>
<a id="external" href="https://example.com/test">external</a>
<a id="root" href="/absolute">root</a><a id="hash" href="#section">hash</a><a id="query" href="?tab=2">query</a>
<template><img id="template" src="../../../media/template.svg"></template>
<script>const text='src="../../../media/not-an-attribute.svg"';</script>
</body></html>`, {
    'src/pages/option/option.html': '<h1>Options</h1>',
    'keep.html': '<a id="back" href="./src/pages/popup/popup.html">popup</a>',
  });
  const attrs = attributes(html);
  assert.equal(attrs.get('plain').src, './media/a%20b.svg?x=1&y=2#icon');
  assert.equal(attrs.get('set').srcset, './media/small.svg 1x, ./media/large.svg 2x');
  assert.equal(attrs.get('data-set').srcset, 'data:image/png;base64,AAAA 1x, ./media/large.svg 2x');
  assert.equal(attrs.get('css').style, "background-image:url('./media/bg.svg')");
  assert.match(html, /url\('\.\/media\/bg\.svg'\)/);
  assert.match(html, /url\(data:image\/png;base64,AAAA\)/);
  assert.equal(attrs.get('sibling').href, './option.html?tab=1#top');
  assert.equal(attrs.get('external').href, 'https://example.com/test');
  assert.equal(attrs.get('root').href, '/absolute');
  assert.equal(attrs.get('hash').href, '#section');
  assert.equal(attrs.get('query').href, '?tab=2');
  assert.equal(attrs.get('template').src, './media/template.svg');
  assert.match(html, /const text='src="\.\.\/\.\.\/\.\.\/media\/not-an-attribute\.svg"'/);
  assert.equal(attributes(await readFile(join(root, 'dist/keep.html'), 'utf8')).get('back').href, './popup.html');
});

test('preserves effective document base when a base href is present', async (t) => {
  const { html } = await emittedHtml(t, '<base href="../../../"><img id="image" src="media/a.svg"><style>body{background:url(media/a.svg)}</style>');
  assert.match(html, /<base href="\.\/">/);
  assert.equal(attributes(html).get('image').src, 'media/a.svg');
  assert.match(html, /url\(media\/a\.svg\)/);
});

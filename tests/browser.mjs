import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { project, runBuild, appFiles, appInputs, staticServer, version } from './helpers.mjs';

for (const base of ['/', './', '', '/demo/']) {
  test(`Chromium: Vite ${version} built pages work with base ${JSON.stringify(base)}`, async (t) => {
    const root = await project(t, appFiles);
    await runBuild(root, { inputs: appInputs, base });
    const server = await staticServer(join(root, 'dist'), base);
    t.after(server.close);
    const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHROMIUM_CHANNEL } : {}), ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
    t.after(() => browser.close());
    t.diagnostic(`Chromium ${browser.version()}`);
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('requestfailed', (req) => errors.push(`${req.url()}: ${req.failure()?.errorText}`));
    page.on('response', (res) => { if (res.status() >= 400) errors.push(`${res.status()} ${res.url()}`); });
    assert.equal((await fetch(`${server.url}missing.js`)).status, 404);
    for (const [file, title] of [['popup.html', 'Popup'], ['option.html', 'Options']]) {
      await page.goto(server.url + file);
      await page.waitForSelector('body[data-ready="yes"]');
      assert.equal(await page.locator('h1').textContent(), title);
      assert.equal(await page.locator('h1').evaluate((element) => getComputedStyle(element).color), 'rgb(12, 34, 56)');
      await page.waitForFunction(() => document.querySelector('#image').naturalWidth === 16);
      await page.locator('#load').click();
      await page.waitForFunction(() => document.querySelector('#status').textContent === 'dynamic loaded');
    }
    assert.deepEqual(errors, []);
  });
}

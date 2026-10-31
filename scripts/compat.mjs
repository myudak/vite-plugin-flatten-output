import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(join(repo, 'package.json'), 'utf8'));
const arguments_ = process.argv.slice(2);
const browser = arguments_.includes('--browser');
const requested = arguments_.filter((argument) => !argument.startsWith('--'));
const versions = requested.length ? requested : ['5.1.0', '5', '6.0.0', '6', '7.0.0', '7', '8.0.0', '8'];
const temporary = await realpath(await mkdtemp(join(tmpdir(), 'flatten-compat-')));
const npmCli = join(repo, 'node_modules/npm/bin/npm-cli.js');
async function run(command, args, cwd) {
  try {
    const result = await exec(command, args, { cwd, maxBuffer: 10 * 1024 * 1024, timeout: 240_000, env: { ...process.env, CI: 'true' } });
    return result.stdout;
  } catch (error) {
    process.stderr.write(error.stdout ?? '');
    process.stderr.write(error.stderr ?? '');
    throw error;
  }
}
const runNpm = (args, cwd) => run(process.execPath, [npmCli, ...args], cwd);
const results = [];
try {
  process.stdout.write('Building and packing the published package...\n');
  await runNpm(['run', 'build'], repo);
  const packed = JSON.parse(await runNpm(['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], repo));
  const tarball = join(temporary, packed[0].filename);
  const names = packed[0].files.map((file) => file.path);
  for (const name of ['README.md', 'LICENSE', 'dist/index.js', 'dist/index.mjs', 'dist/index.d.ts', 'dist/index.d.mts']) {
    if (!names.includes(name)) throw new Error(`Package is missing ${name}`);
  }
  for (const spec of versions) {
    const result = { requested: spec, node: process.version, platform: process.platform, status: 'running' };
    results.push(result);
    process.stdout.write(`\nInstalling packed consumer with vite@${spec}...\n`);
    const consumer = join(temporary, `vite-${spec}`);
    await mkdir(consumer);
    await writeFile(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: {
      'vite-plugin-flatten-output': `file:${tarball}`, vite: spec, typescript: pkg.devDependencies.typescript,
      '@types/node': pkg.devDependencies['@types/node'], ...(browser ? { playwright: pkg.devDependencies.playwright } : {}),
    } }));
    await runNpm(['install', '--no-audit', '--no-fund', '--package-lock=false'], consumer);
    await cp(join(repo, 'tests'), join(consumer, 'tests'), { recursive: true });
    const installed = JSON.parse(await readFile(join(consumer, 'node_modules/vite/package.json'), 'utf8')).version;
    result.vite = installed;
    process.stdout.write(`Running real build tests against Vite ${installed}...\n`);
    const tests = await run(process.execPath, ['--test', '--test-concurrency=1', 'tests/build.test.mjs', 'tests/html.test.mjs', ...(browser ? ['tests/browser.mjs'] : [])], consumer);
    process.stdout.write(tests);
    result.build = 'passed';
    result.browser = browser ? 'passed' : 'not run';
    if (browser) result.chromium = tests.match(/Chromium (\d[\d.]+)/)?.[1];
    const types = 'import flattenOutput, { type FlattenOutputOptions } from "vite-plugin-flatten-output";\nimport type { Plugin } from "vite";\nconst options: FlattenOutputOptions = { removeDirs: ["src/pages"] };\nconst plugin: Plugin = flattenOutput(options);\nconsole.log(plugin.name);\n';
    await writeFile(join(consumer, 'consumer.mts'), types);
    await writeFile(join(consumer, 'consumer.cts'), types.replace('import type { Plugin } from "vite";\n', '').replace('const plugin: Plugin', 'const plugin'));
    await run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2020', '--esModuleInterop', 'consumer.mts', 'consumer.cts'], consumer);
    await writeFile(join(consumer, 'index.html'), '<h1>Config consumer</h1>');
    await writeFile(join(consumer, 'vite.config.mjs'), 'import flattenOutput from "vite-plugin-flatten-output"; export default { plugins: [flattenOutput({ removeDirs: [] })] };');
    await writeFile(join(consumer, 'vite.config.cjs'), 'const flattenOutput = require("vite-plugin-flatten-output"); if (typeof flattenOutput !== "function") throw new Error("CJS default export is not callable"); module.exports = { plugins: [flattenOutput({ removeDirs: [] })] };');
    for (const config of ['vite.config.mjs', 'vite.config.cjs']) await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', config], consumer);
    Object.assign(result, { types: 'passed', esm: 'passed', cjs: 'passed', status: 'passed' });
    process.stdout.write(`PASS Vite ${installed}: tarball, real builds, types, ESM/CJS${browser ? ', Chromium' : ''}\n`);
  }
} finally {
  for (const result of results) if (result.status === 'running') result.status = 'failed';
  await mkdir(join(repo, '.test-results'), { recursive: true });
  await writeFile(join(repo, '.test-results/compat.json'), JSON.stringify(results, null, 2) + '\n');
  await rm(temporary, { recursive: true, force: true });
}

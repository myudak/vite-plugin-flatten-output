import { copyFile } from 'node:fs/promises';
await copyFile(new URL('../dist/index.d.ts', import.meta.url), new URL('../dist/index.d.mts', import.meta.url));

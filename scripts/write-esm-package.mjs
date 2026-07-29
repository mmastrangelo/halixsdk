import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const esmOutputDirectory = resolve(repositoryRoot, 'lib', 'esm');

await mkdir(esmOutputDirectory, { recursive: true });
await writeFile(
    resolve(esmOutputDirectory, 'package.json'),
    `${JSON.stringify({ type: 'module' }, null, 2)}\n`,
    'utf8',
);

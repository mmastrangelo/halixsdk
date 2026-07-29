import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'halix-action-sdk-package-'));

async function runNode(source, moduleType, workingDirectory) {
    await execFileAsync(
        process.execPath,
        [`--input-type=${moduleType}`, '--eval', source],
        {
            cwd: workingDirectory,
            maxBuffer: 10 * 1024 * 1024,
        },
    );
}

try {
    const packDirectory = join(temporaryRoot, 'pack');
    const consumerDirectory = join(temporaryRoot, 'consumer');
    await mkdir(packDirectory, { recursive: true });
    await mkdir(consumerDirectory, { recursive: true });

    const { stdout: packOutput } = await execFileAsync(
        'npm',
        ['pack', '--silent', '--json', '--pack-destination', packDirectory],
        {
            cwd: repositoryRoot,
            maxBuffer: 10 * 1024 * 1024,
        },
    );
    const packResult = JSON.parse(packOutput);
    assert.equal(packResult.length, 1, 'npm pack should produce exactly one archive');

    const packedFiles = new Set(packResult[0].files.map((file) => file.path));
    assert(packedFiles.has('lib/esm/package.json'), 'packed SDK must include the ESM package boundary');
    assert(packedFiles.has('lib/esm/index.js'), 'packed SDK must include the ESM entrypoint');
    assert(packedFiles.has('lib/cjs/index.js'), 'packed SDK must include the CommonJS entrypoint');

    const archivePath = join(packDirectory, packResult[0].filename);
    await writeFile(
        join(consumerDirectory, 'package.json'),
        `${JSON.stringify({
            name: 'halix-action-sdk-package-smoke',
            version: '1.0.0',
            private: true,
        }, null, 2)}\n`,
        'utf8',
    );
    await execFileAsync(
        'npm',
        [
            'install',
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            '--no-package-lock',
            archivePath,
        ],
        {
            cwd: consumerDirectory,
            maxBuffer: 10 * 1024 * 1024,
        },
    );

    await runNode(
        `
            import assert from 'node:assert/strict';
            import * as hx from '@halix/action-sdk';

            hx.initialize({
                sandboxKey: 'sbx~esm',
                serviceAddress: 'https://example.invalid',
                actionSubject: { objKey: 'obj~esm' },
                userContext: {},
                params: {},
                authToken: 'esm-token',
            });

            assert.equal(hx.sandboxKey, 'sbx~esm');
            assert.equal(typeof hx.getObject, 'function');
            assert.deepEqual(
                hx.prepareSuccessResponse({
                    responseType: 'singleValueAction',
                    isError: false,
                    value: 'esm-ok',
                }),
                {
                    responseType: 'singleValueAction',
                    isError: false,
                    value: 'esm-ok',
                },
            );
        `,
        'module',
        consumerDirectory,
    );

    await runNode(
        `
            const assert = require('node:assert/strict');
            const hx = require('@halix/action-sdk');

            hx.initialize({
                sandboxKey: 'sbx~cjs',
                serviceAddress: 'https://example.invalid',
                actionSubject: { objKey: 'obj~cjs' },
                userContext: {},
                params: {},
                authToken: 'cjs-token',
            });

            assert.equal(hx.sandboxKey, 'sbx~cjs');
            assert.equal(typeof hx.getObject, 'function');
            assert.equal(hx.prepareErrorResponse('cjs-ok').errorMessage, 'cjs-ok');
        `,
        'commonjs',
        consumerDirectory,
    );

    console.log(`Packed ESM and CommonJS smoke tests passed on Node ${process.versions.node}.`);
} finally {
    await rm(temporaryRoot, { recursive: true, force: true });
}

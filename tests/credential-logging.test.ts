import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_DIRECTORY = new URL('../src/', import.meta.url);
const CREDENTIAL_LOG_PATTERN = /console\.(?:debug|error|info|log|warn)\([^\n]*(?:auth(?:entication)?token|accessToken|authorization|bearer)/i;

describe('credential logging', () => {
    it('does not write credentials to browser or server logs', () => {
        const credentialLoggingFiles = readdirSync(SOURCE_DIRECTORY)
            .filter(fileName => extname(fileName) === '.ts')
            .filter(fileName => CREDENTIAL_LOG_PATTERN.test(
                readFileSync(join(SOURCE_DIRECTORY.pathname, fileName), 'utf8'),
            ));

        expect(credentialLoggingFiles).toEqual([]);
    });
});

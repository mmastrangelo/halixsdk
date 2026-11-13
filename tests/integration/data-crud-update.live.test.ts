import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios from 'axios';
import { getObject, updateObject, UpdateConflictError } from '../../src/data-crud';
import * as sdk from '../../src/index';

/**
 * Live integration tests for updateObject.
 *
 * These tests make real HTTP calls and change one number on one existing record, then put the
 * starting value back. They need a service that returns a record version on a single-record read
 * and checks it on a save. They are excluded from the regular test suite and must be run
 * explicitly via:
 *
 *   npm run test:integration
 *
 * Required environment variables:
 *   HALIX_SERVICE_ADDRESS               - Halix service base URL (e.g. http://localhost:4200)
 *   HALIX_SANDBOX_KEY                   - Sandbox identifier
 *   HALIX_ORG_KEY                       - Organization key
 *   HALIX_TEST_USERNAME                 - Test account username
 *   HALIX_TEST_PASSWORD                 - Test account password
 *   HALIX_TEST_SITE_ID                  - Site ID for authentication (e.g. 'platform')
 *   HALIX_TEST_AUTH_TOKEN               - A session token for the sandbox, in place of the three above
 *   HALIX_TEST_UPDATE_ELEMENT_ID        - Data element of the record to update
 *   HALIX_TEST_UPDATE_KEY               - Key of an existing record the test account may save
 *   HALIX_TEST_UPDATE_NUMBER_ATTRIBUTE  - A number attribute on that record the tests may change
 *
 * All variables must be set or the entire suite is skipped.
 */

const SERVICE_ADDRESS = process.env.HALIX_SERVICE_ADDRESS;
const SANDBOX_KEY = process.env.HALIX_SANDBOX_KEY;
const ORG_KEY = process.env.HALIX_ORG_KEY;
const TEST_USERNAME = process.env.HALIX_TEST_USERNAME;
const TEST_PASSWORD = process.env.HALIX_TEST_PASSWORD;
const TEST_SITE_ID = process.env.HALIX_TEST_SITE_ID;
const ELEMENT_ID = process.env.HALIX_TEST_UPDATE_ELEMENT_ID;
const RECORD_KEY = process.env.HALIX_TEST_UPDATE_KEY;
const NUMBER_ATTRIBUTE = process.env.HALIX_TEST_UPDATE_NUMBER_ATTRIBUTE;

const TEST_AUTH_TOKEN = process.env.HALIX_TEST_AUTH_TOKEN;

const hasSignIn = TEST_AUTH_TOKEN || (TEST_USERNAME && TEST_PASSWORD && TEST_SITE_ID);
const hasConfig = SERVICE_ADDRESS && SANDBOX_KEY && ORG_KEY && hasSignIn
    && ELEMENT_ID && RECORD_KEY && NUMBER_ATTRIBUTE;

const TIMEOUT = 60_000;
const CONCURRENT_UPDATES = 20;

const describeLive = hasConfig ? describe : describe.skip;

async function authenticate(): Promise<string> {
    if (TEST_AUTH_TOKEN) {
        return TEST_AUTH_TOKEN;
    }

    const response = await axios.post(`${SERVICE_ADDRESS}/auth/authorization?sandboxKey=${SANDBOX_KEY}`, {
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
        siteID: TEST_SITE_ID,
    });

    const authToken = response.data.authToken;
    if (!authToken) {
        throw new Error('Authentication failed: no authToken in response');
    }

    return authToken;
}

async function currentValue(): Promise<number> {
    const record = await getObject(ELEMENT_ID!, RECORD_KEY!);
    return Number(record?.[NUMBER_ATTRIBUTE!] ?? 0);
}

function addOne(record: any): any {
    record[NUMBER_ATTRIBUTE!] = Number(record[NUMBER_ATTRIBUTE!] ?? 0) + 1;
    return record;
}

describeLive('updateObject - Live Integration Tests', () => {
    let startingValue = 0;
    let startedWithoutValue = false;

    beforeAll(async () => {
        const authToken = await authenticate();

        sdk.initialize({
            body: {
                sandboxKey: SANDBOX_KEY!,
                serviceAddress: SERVICE_ADDRESS!,
                actionSubject: {},
                userContext: {
                    user: { objKey: 'integration-test-user' },
                    userProxy: { objType: 'TestUser' },
                    orgProxy: { objType: 'TestOrg' },
                    orgProxyKey: 'test-org-proxy',
                    orgKey: ORG_KEY!,
                    userProxyKey: 'test-user-proxy'
                },
                params: {},
                authToken
            }
        });

        const record = await getObject(ELEMENT_ID!, RECORD_KEY!);
        if (!record) {
            throw new Error(`Record ${RECORD_KEY} was not found, so there is nothing to update`);
        }
        startedWithoutValue = record[NUMBER_ATTRIBUTE!] === undefined || record[NUMBER_ATTRIBUTE!] === null;
        startingValue = Number(record[NUMBER_ATTRIBUTE!] ?? 0);
    }, TIMEOUT);

    afterAll(async () => {
        if (!hasConfig) {
            return;
        }
        await updateObject(ELEMENT_ID!, RECORD_KEY!, (record: any) => {
            if (startedWithoutValue) {
                delete record[NUMBER_ATTRIBUTE!];
            } else {
                record[NUMBER_ATTRIBUTE!] = startingValue;
            }
            return record;
        }, { maxAttempts: 10, timeoutMs: 30_000 });
    }, TIMEOUT);

    it('applies one change and returns the saved record', async () => {
        const before = await currentValue();

        const saved = await updateObject(ELEMENT_ID!, RECORD_KEY!, addOne);

        expect(Number(saved[NUMBER_ATTRIBUTE!])).toBe(before + 1);
        expect(await currentValue()).toBe(before + 1);
    }, TIMEOUT);

    it('retries a change that lost to another save and keeps both', async () => {
        const before = await currentValue();
        let runs = 0;

        await updateObject(ELEMENT_ID!, RECORD_KEY!, async (record: any) => {
            runs++;
            if (runs === 1) {
                // Another save lands between this attempt's read and its save.
                await updateObject(ELEMENT_ID!, RECORD_KEY!, addOne);
            }
            return addOne(record);
        });

        expect(runs).toBe(2);
        expect(await currentValue()).toBe(before + 2);
    }, TIMEOUT);

    it('ends with UpdateConflictError when its only attempt loses, and saves nothing of its own', async () => {
        const before = await currentValue();

        const losing = updateObject(ELEMENT_ID!, RECORD_KEY!, async (record: any) => {
            await updateObject(ELEMENT_ID!, RECORD_KEY!, addOne);
            record[NUMBER_ATTRIBUTE!] = -1;
            return record;
        }, { maxAttempts: 1 });

        await expect(losing).rejects.toBeInstanceOf(UpdateConflictError);
        expect(await currentValue()).toBe(before + 1);
    }, TIMEOUT);

    it(`loses no update across ${CONCURRENT_UPDATES} concurrent changes`, async () => {
        const before = await currentValue();

        const results = await Promise.allSettled(
            Array.from({ length: CONCURRENT_UPDATES }, () =>
                updateObject(ELEMENT_ID!, RECORD_KEY!, addOne, { maxAttempts: 50, timeoutMs: 45_000 }))
        );

        const applied = results.filter(result => result.status === 'fulfilled').length;
        const values = results
            .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
            .map(result => Number(result.value[NUMBER_ATTRIBUTE!]));

        // Every update that reported success is counted exactly once, and no two saw the same value.
        expect(await currentValue()).toBe(before + applied);
        expect(new Set(values).size).toBe(applied);
        expect(applied).toBe(CONCURRENT_UPDATES);
    }, TIMEOUT);
});

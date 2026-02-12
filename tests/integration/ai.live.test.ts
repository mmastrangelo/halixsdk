import { describe, it, expect, beforeAll } from 'vitest';
import axios from 'axios';
import { sendAIMessage, sendAIMessageAsObservable } from '../../src/ai';
import * as sdk from '../../src/index';

/**
 * Live integration tests for the AI module.
 *
 * These tests make real HTTP calls through the Halix AI proxy endpoint.
 * They are excluded from the regular test suite and must be run explicitly via:
 *
 *   npm run test:integration
 *
 * Required environment variables:
 *   HALIX_SERVICE_ADDRESS  - Halix service base URL (e.g. https://api.halix.io)
 *   HALIX_SANDBOX_KEY      - Sandbox identifier
 *   HALIX_ORG_KEY          - Organization key
 *   HALIX_TEST_USERNAME    - Test account username
 *   HALIX_TEST_PASSWORD    - Test account password
 *   HALIX_TEST_SITE_ID     - Site ID for authentication (e.g. 'platform')
 *
 * All variables must be set or the entire suite is skipped.
 */

const SERVICE_ADDRESS = process.env.HALIX_SERVICE_ADDRESS;
const SANDBOX_KEY = process.env.HALIX_SANDBOX_KEY;
const ORG_KEY = process.env.HALIX_ORG_KEY;
const TEST_USERNAME = process.env.HALIX_TEST_USERNAME;
const TEST_PASSWORD = process.env.HALIX_TEST_PASSWORD;
const TEST_SITE_ID = process.env.HALIX_TEST_SITE_ID;

const hasConfig = SERVICE_ADDRESS && SANDBOX_KEY && ORG_KEY && TEST_USERNAME && TEST_PASSWORD && TEST_SITE_ID;

const TEST_MESSAGE = 'Reply with exactly one word: hello';
const TIMEOUT = 30_000;

const describeLive = hasConfig ? describe : describe.skip;

/**
 * Authenticates against the Halix auth service and returns the auth token.
 */
async function authenticate(): Promise<string> {
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

describeLive('AI Module - Live Integration Tests', () => {

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
    }, TIMEOUT);

    // ----------------------------------------------------------------
    // Anthropic
    // ----------------------------------------------------------------
    describe('Anthropic (via proxy)', () => {
        it('sends a message to Claude Opus 4.6', async () => {
            const response = await sendAIMessage(TEST_MESSAGE, 'claude-opus-4-6');

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);

        it('sends a message to Claude Sonnet 4.5', async () => {
            const response = await sendAIMessage(TEST_MESSAGE, 'claude-sonnet-4-5');

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);

        it('supports system prompt with Claude', async () => {
            const response = await sendAIMessage(
                'What are you?',
                'claude-sonnet-4-5',
                { systemPrompt: 'You are a pirate. Always respond in pirate speak.', maxTokens: 256 }
            );

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);
    });

    // ----------------------------------------------------------------
    // OpenAI
    // ----------------------------------------------------------------
    describe('OpenAI (via proxy)', () => {
        it('sends a message to GPT-4.1', async () => {
            const response = await sendAIMessage(TEST_MESSAGE, 'gpt-4.1');

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);

        it('sends a message to GPT-5.2', async () => {
            const response = await sendAIMessage(TEST_MESSAGE, 'gpt-5.2');

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);

        it('supports system prompt with GPT', async () => {
            const response = await sendAIMessage(
                'What are you?',
                'gpt-4.1',
                { systemPrompt: 'You are a pirate. Always respond in pirate speak.', maxTokens: 256 }
            );

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);
    });

    // ----------------------------------------------------------------
    // Google
    // ----------------------------------------------------------------
    describe('Google (via proxy)', () => {
        it('sends a message to Gemini 3 Pro', async () => {
            const response = await sendAIMessage(TEST_MESSAGE, 'gemini-3-pro-preview');

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);

        it('supports system prompt with Gemini 3', async () => {
            const response = await sendAIMessage(
                'What are you?',
                'gemini-3-pro-preview',
                { systemPrompt: 'You are a pirate. Always respond in pirate speak.', maxTokens: 256 }
            );

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);
    });

    // ----------------------------------------------------------------
    // xAI
    // ----------------------------------------------------------------
    describe('xAI (via proxy)', () => {
        it('sends a message to Grok', async () => {
            const response = await sendAIMessage(TEST_MESSAGE, 'grok-3-mini-fast');

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);

        it('supports system prompt with Grok', async () => {
            const response = await sendAIMessage(
                'What are you?',
                'grok-3-mini-fast',
                { systemPrompt: 'You are a pirate. Always respond in pirate speak.', maxTokens: 256 }
            );

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);
    });

    // ----------------------------------------------------------------
    // Observable wrapper (live)
    // ----------------------------------------------------------------
    describe('Observable wrapper (via proxy)', () => {
        it('works via observable', async () => {
            const response = await new Promise<string>((resolve, reject) => {
                sendAIMessageAsObservable(TEST_MESSAGE, 'gpt-4.1').subscribe({
                    next: (val) => resolve(val),
                    error: (err) => reject(err)
                });
            });

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);
    });
});

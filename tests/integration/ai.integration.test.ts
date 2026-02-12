import { describe, it, expect, vi, beforeAll } from 'vitest';
import { sendAIMessage, sendAIMessageAsObservable } from '../../src/ai';

/**
 * Integration tests for the AI module.
 *
 * These tests make real HTTP calls to LLM provider APIs. They are excluded from
 * the regular test suite and must be run explicitly via:
 *
 *   npm run test:integration
 *
 * Required environment variables (set whichever providers you want to test):
 *   ANTHROPIC_API_KEY  - Anthropic API key
 *   OPENAI_API_KEY     - OpenAI API key
 *   GOOGLE_API_KEY     - Google AI API key
 *   XAI_API_KEY        - xAI API key
 *
 * Providers without a corresponding env var will be skipped automatically.
 */

// Mock getOrganizationPreference so it returns API keys from env vars
// instead of requiring a running Halix service.
vi.mock('../../src/preferences', () => ({
    getOrganizationPreference: vi.fn(async (prefID: string): Promise<string | undefined> => {
        const keyMap: Record<string, string | undefined> = {
            AnthropicAPIKey: process.env.ANTHROPIC_API_KEY,
            OpenAIAPIKey: process.env.OPENAI_API_KEY,
            GoogleAPIKey: process.env.GOOGLE_API_KEY,
            xAIAPIKey: process.env.XAI_API_KEY,
        };
        return keyMap[prefID];
    })
}));

const TEST_MESSAGE = 'Reply with exactly one word: hello';
const TIMEOUT = 30_000;

// Helper to conditionally run a test only when the env var is set
function describeProvider(
    providerName: string,
    envVar: string,
    tests: () => void
) {
    const key = process.env[envVar];
    if (key) {
        describe(providerName, tests);
    } else {
        describe.skip(`${providerName} (${envVar} not set)`, tests);
    }
}

describe('AI Module - Integration Tests', () => {

    // ----------------------------------------------------------------
    // Anthropic
    // ----------------------------------------------------------------
    describeProvider('Anthropic', 'ANTHROPIC_API_KEY', () => {
        it('sends a message to Claude Opus 4.6 and receives a response', async () => {
            const response = await sendAIMessage(TEST_MESSAGE, 'claude-opus-4-6');

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);

        it('sends a message to Claude Sonnet 4.5 and receives a response', async () => {
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

        it('works via observable wrapper', async () => {
            const response = await new Promise<string>((resolve, reject) => {
                sendAIMessageAsObservable(TEST_MESSAGE, 'claude-sonnet-4-5').subscribe({
                    next: (val) => resolve(val),
                    error: (err) => reject(err)
                });
            });

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);
    });

    // ----------------------------------------------------------------
    // OpenAI
    // ----------------------------------------------------------------
    describeProvider('OpenAI', 'OPENAI_API_KEY', () => {
        it('sends a message to GPT-4.1 and receives a response', async () => {
            const response = await sendAIMessage(TEST_MESSAGE, 'gpt-4.1');

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);

        it('sends a message to GPT-5.2 and receives a response', async () => {
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

        it('works via observable wrapper', async () => {
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

    // ----------------------------------------------------------------
    // Google
    // ----------------------------------------------------------------
    describeProvider('Google', 'GOOGLE_API_KEY', () => {
        it('sends a message to Gemini 3 Pro and receives a response', async () => {
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

        it('works via observable wrapper', async () => {
            const response = await new Promise<string>((resolve, reject) => {
                sendAIMessageAsObservable(TEST_MESSAGE, 'gemini-3-pro-preview').subscribe({
                    next: (val) => resolve(val),
                    error: (err) => reject(err)
                });
            });

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);
    });

    // ----------------------------------------------------------------
    // xAI
    // ----------------------------------------------------------------
    describeProvider('xAI', 'XAI_API_KEY', () => {
        it('sends a message to Grok and receives a response', async () => {
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

        it('works via observable wrapper', async () => {
            const response = await new Promise<string>((resolve, reject) => {
                sendAIMessageAsObservable(TEST_MESSAGE, 'grok-3-mini-fast').subscribe({
                    next: (val) => resolve(val),
                    error: (err) => reject(err)
                });
            });

            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response.length).toBeGreaterThan(0);
        }, TIMEOUT);
    });

    // ----------------------------------------------------------------
    // Error handling (always runs, no API key needed)
    // ----------------------------------------------------------------
    describe('Error handling', () => {
        it('throws for an unrecognized model name', async () => {
            await expect(sendAIMessage('hello', 'unknown-model-xyz'))
                .rejects.toThrow('Unable to detect LLM provider');
        });
    });
});

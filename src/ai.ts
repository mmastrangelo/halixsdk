// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/ai
 * @description AI functions for the Halix Platform action SDK. This module provides
 * functions for sending messages to LLM providers (Anthropic, OpenAI, Google, xAI)
 * using API keys stored as organization preferences.
 */

import axios from 'axios';
import { from, Observable } from 'rxjs';
import { getOrganizationPreference } from './preferences';

// ================================================================================
// TYPES AND ENUMS
// ================================================================================

/**
 * Supported LLM providers.
 */
export enum LLMProvider {
    Anthropic = 'anthropic',
    OpenAI = 'openai',
    Google = 'google',
    xAI = 'xai'
}

/**
 * Options for configuring an AI message request.
 */
export interface AIRequestOptions {
    /** Optional system prompt to guide the model's behavior */
    systemPrompt?: string;
    /** Maximum number of tokens in the response. Defaults to 1024 */
    maxTokens?: number;
}

// ================================================================================
// INTERNAL HELPERS
// ================================================================================

/**
 * Maps an LLM provider to the corresponding organization preference key.
 */
const providerPreferenceKeys: Record<LLMProvider, string> = {
    [LLMProvider.Anthropic]: 'AnthropicAPIKey',
    [LLMProvider.OpenAI]: 'OpenAIAPIKey',
    [LLMProvider.Google]: 'GoogleAPIKey',
    [LLMProvider.xAI]: 'xAIAPIKey'
};

/**
 * Detects the LLM provider from a model name string.
 *
 * @param model - The model identifier (e.g. 'claude-3-sonnet', 'gpt-4o', 'gemini-2.0-flash', 'grok-3')
 * @returns The detected LLMProvider
 * @throws Error if the model name cannot be mapped to a known provider
 */
function detectProvider(model: string): LLMProvider {
    const lowerModel = model.toLowerCase();

    if (lowerModel.startsWith('claude')) {
        return LLMProvider.Anthropic;
    }
    if (lowerModel.startsWith('gpt') || lowerModel.startsWith('o1') || lowerModel.startsWith('o3') || lowerModel.startsWith('o4')) {
        return LLMProvider.OpenAI;
    }
    if (lowerModel.startsWith('gemini')) {
        return LLMProvider.Google;
    }
    if (lowerModel.startsWith('grok')) {
        return LLMProvider.xAI;
    }

    throw new Error(
        `Unable to detect LLM provider for model "${model}". ` +
        `Supported model prefixes: claude (Anthropic), gpt/o1/o3/o4 (OpenAI), gemini (Google), grok (xAI).`
    );
}

/**
 * Fetches the API key for the given provider from organization preferences.
 */
async function getApiKey(provider: LLMProvider): Promise<string> {
    const prefKey = providerPreferenceKeys[provider];
    const apiKey = await getOrganizationPreference(prefKey);

    if (!apiKey) {
        throw new Error(
            `API key not configured. Set the "${prefKey}" organization preference to use ${provider} models.`
        );
    }

    return apiKey;
}

/**
 * Sends a message to the Anthropic Messages API and returns the response text.
 */
async function callAnthropic(model: string, message: string, apiKey: string, options: AIRequestOptions): Promise<string> {
    const body: Record<string, any> = {
        model,
        max_tokens: options.maxTokens ?? 1024,
        messages: [{ role: 'user', content: message }]
    };

    if (options.systemPrompt) {
        body.system = options.systemPrompt;
    }

    const response = await axios.post('https://api.anthropic.com/v1/messages', body, {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
        }
    });

    return response.data.content[0].text;
}

/**
 * Sends a message to an OpenAI-compatible chat completions API and returns the response text.
 * Used for both OpenAI and xAI (which uses the same API format).
 */
async function callOpenAICompatible(baseUrl: string, model: string, message: string, apiKey: string, options: AIRequestOptions): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];

    if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: message });

    // GPT-5.x and newer models require max_completion_tokens instead of max_tokens
    const lowerModel = model.toLowerCase();
    const useMaxCompletionTokens = lowerModel.startsWith('gpt-5') || lowerModel.startsWith('gpt-6');
    const tokenLimit = options.maxTokens ?? 1024;

    const body: Record<string, any> = {
        model,
        messages,
        ...(useMaxCompletionTokens
            ? { max_completion_tokens: tokenLimit }
            : { max_tokens: tokenLimit })
    };

    const response = await axios.post(`${baseUrl}/chat/completions`, body, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data.choices[0].message.content;
}

/**
 * Sends a message to the Google Gemini API and returns the response text.
 */
async function callGoogle(model: string, message: string, apiKey: string, options: AIRequestOptions): Promise<string> {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (options.systemPrompt) {
        contents.push({ role: 'user', parts: [{ text: options.systemPrompt }] });
        contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const body: Record<string, any> = {
        contents,
        generationConfig: {
            maxOutputTokens: options.maxTokens ?? 1024
        }
    };

    const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        body,
        {
            headers: { 'Content-Type': 'application/json' }
        }
    );

    return response.data.candidates[0].content.parts[0].text;
}

// ================================================================================
// PUBLIC API
// ================================================================================

/**
 * Sends a message to an LLM and returns its text response.
 *
 * The LLM provider is automatically detected from the model name. The corresponding
 * API key is retrieved from organization preferences:
 * - Anthropic (claude-*) → AnthropicAPIKey
 * - OpenAI (gpt-*, o1-*, o3-*, o4-*) → OpenAIAPIKey
 * - Google (gemini-*) → GoogleAPIKey
 * - xAI (grok-*) → xAIAPIKey
 *
 * @param message - The user message to send to the model
 * @param model - The model identifier (e.g. 'claude-3-sonnet-20240229', 'gpt-4o', 'gemini-2.0-flash', 'grok-3')
 * @param options - Optional configuration (system prompt, max tokens)
 * @returns Promise<string> - The model's text response
 * @throws Error if SDK not initialized, organization context unavailable, API key not configured, or model not recognized
 *
 * @example
 * // Simple usage
 * const response = await sendAIMessage('What is the capital of France?', 'gpt-4o');
 *
 * @example
 * // With options
 * const response = await sendAIMessage(
 *     'Summarize this document.',
 *     'claude-3-sonnet-20240229',
 *     { systemPrompt: 'You are a helpful assistant.', maxTokens: 2048 }
 * );
 */
export async function sendAIMessage(message: string, model: string, options?: AIRequestOptions): Promise<string> {
    const resolvedOptions = options ?? {};
    const provider = detectProvider(model);
    const apiKey = await getApiKey(provider);

    switch (provider) {
        case LLMProvider.Anthropic:
            return callAnthropic(model, message, apiKey, resolvedOptions);
        case LLMProvider.OpenAI:
            return callOpenAICompatible('https://api.openai.com/v1', model, message, apiKey, resolvedOptions);
        case LLMProvider.Google:
            return callGoogle(model, message, apiKey, resolvedOptions);
        case LLMProvider.xAI:
            return callOpenAICompatible('https://api.x.ai/v1', model, message, apiKey, resolvedOptions);
    }
}

/**
 * Observable version of sendAIMessage. See sendAIMessage for details.
 */
export function sendAIMessageAsObservable(message: string, model: string, options?: AIRequestOptions): Observable<string> {
    return from(sendAIMessage(message, model, options));
}

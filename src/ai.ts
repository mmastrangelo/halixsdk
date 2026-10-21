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
import { from, Observable, lastValueFrom } from 'rxjs';
import { serviceAddress, getAuthToken, sandboxKey } from './sdk-general.js';

// ================================================================================
// TYPES
// ================================================================================

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
// PUBLIC API
// ================================================================================

/**
 * Sends a message to an LLM and returns its text response.
 *
 * All requests are proxied through the Halix service, which handles provider
 * authentication and API key management server-side. The LLM provider is
 * automatically detected from the model name:
 * - Anthropic (claude-*)
 * - OpenAI (gpt-*, o1-*, o3-*, o4-*)
 * - Google (gemini-*)
 * - xAI (grok-*)
 *
 * @param message - The user message to send to the model
 * @param model - The model identifier (e.g. 'claude-sonnet-4-5', 'gpt-4.1', 'gemini-3-pro-preview', 'grok-3')
 * @param options - Optional configuration (system prompt, max tokens)
 * @returns Promise<string> - The model's text response
 * @throws Error if SDK not initialized or the request fails
 *
 * @example
 * // Simple usage
 * const response = await sendAIMessage('What is the capital of France?', 'gpt-4.1');
 *
 * @example
 * // With options
 * const response = await sendAIMessage(
 *     'Summarize this document.',
 *     'claude-sonnet-4-5',
 *     { systemPrompt: 'You are a helpful assistant.', maxTokens: 2048 }
 * );
 */
export async function sendAIMessage(message: string, model: string, options?: AIRequestOptions): Promise<string> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    const url = `${serviceAddress}/assistant/sandboxes/${sandboxKey}/sendMessage`;

    const body: Record<string, any> = {
        message,
        model,
    };

    if (options?.systemPrompt) {
        body.systemPrompt = options.systemPrompt;
    }
    if (options?.maxTokens) {
        body.maxTokens = options.maxTokens;
    }

    const authToken = await lastValueFrom(getAuthToken());

    const response = await axios.post(url, body, {
        headers: { 'Authorization': `Bearer ${authToken}` },
    });

    return response.data;
}

/**
 * Observable version of sendAIMessage. See sendAIMessage for details.
 */
export function sendAIMessageAsObservable(message: string, model: string, options?: AIRequestOptions): Observable<string> {
    return from(sendAIMessage(message, model, options));
}

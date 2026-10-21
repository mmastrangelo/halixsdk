# AI Proxy Endpoint Specification

## Overview

The Halix platform needs a new server-side endpoint that proxies LLM requests on behalf of client applications. This endpoint eliminates the need for API keys to be exposed to the browser and provides a unified interface across all supported LLM providers.

The `@halix/action-sdk` has already been updated to call this endpoint. Once implemented, SDK consumers will be able to send messages to any supported LLM model via `sendAIMessage()`.

---

## Endpoint

```
POST /assistant/sandboxes/:sandboxKey/sendMessage
```

### Path Parameters

| Parameter    | Type   | Description                          |
|--------------|--------|--------------------------------------|
| `sandboxKey` | string | The sandbox identifier for the request |

### Headers

| Header          | Type   | Required | Description                        |
|-----------------|--------|----------|------------------------------------|
| `Authorization` | string | Yes      | `Bearer <authToken>` - Standard Halix auth token |

### Request Body

```json
{
  "message": "string (required) - The user message to send to the model",
  "model": "string (required) - The LLM model identifier",
  "systemPrompt": "string (optional) - System prompt to guide model behavior",
  "maxTokens": "number (optional) - Maximum tokens in the response, default 1024"
}
```

### Response

- **Content-Type:** `text/plain` or `application/json`
- **Body:** The model's text response as a plain string

### Example

**Request:**
```
POST /assistant/sandboxes/sb_abc123/sendMessage
Authorization: Bearer eyJhbG...
Content-Type: application/json

{
  "message": "What is the capital of France?",
  "model": "gpt-4.1",
  "systemPrompt": "You are a helpful assistant.",
  "maxTokens": 512
}
```

**Response:**
```
200 OK

The capital of France is Paris.
```

---

## Provider Detection and Routing

The endpoint must detect the LLM provider from the `model` field and route the request to the correct provider API.

| Model Prefix         | Provider   | API Endpoint                                                                 |
|----------------------|------------|------------------------------------------------------------------------------|
| `claude-*`           | Anthropic  | `POST https://api.anthropic.com/v1/messages`                                 |
| `gpt-*`, `o1-*`, `o3-*`, `o4-*` | OpenAI | `POST https://api.openai.com/v1/chat/completions`                |
| `gemini-*`           | Google     | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| `grok-*`             | xAI        | `POST https://api.x.ai/v1/chat/completions`                                 |

If the model prefix does not match any known provider, return a **400 Bad Request** with a descriptive error message.

---

## API Key Retrieval

API keys are stored as **organization preferences**. The endpoint should retrieve the appropriate key based on the detected provider:

| Provider  | Organization Preference Key |
|-----------|-----------------------------|
| Anthropic | `AnthropicAPIKey`           |
| OpenAI    | `OpenAIAPIKey`              |
| Google    | `GoogleAPIKey`              |
| xAI       | `xAIAPIKey`                 |

If the preference is not set or is empty, return a **400 Bad Request** with a message indicating which preference needs to be configured.

---

## Provider-Specific Request Formats

### Anthropic

```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: <AnthropicAPIKey>
  anthropic-version: 2023-06-01
  Content-Type: application/json

Body:
{
  "model": "<model>",
  "max_tokens": <maxTokens | 1024>,
  "messages": [{ "role": "user", "content": "<message>" }],
  "system": "<systemPrompt>"  // only include if provided
}

Response field: response.content[0].text
```

### OpenAI

```
POST https://api.openai.com/v1/chat/completions
Headers:
  Authorization: Bearer <OpenAIAPIKey>
  Content-Type: application/json

Body:
{
  "model": "<model>",
  "messages": [
    { "role": "system", "content": "<systemPrompt>" },  // only include if provided
    { "role": "user", "content": "<message>" }
  ],
  "max_tokens": <maxTokens | 1024>          // for gpt-4.x and earlier
  "max_completion_tokens": <maxTokens | 1024>  // for gpt-5.x and later
}

Response field: response.choices[0].message.content
```

**Note:** GPT-5.x and newer models require `max_completion_tokens` instead of `max_tokens`. Using `max_tokens` with GPT-5.x will return a 400 error from OpenAI.

### Google (Gemini)

```
POST https://generativelanguage.googleapis.com/v1beta/models/<model>:generateContent?key=<GoogleAPIKey>
Headers:
  Content-Type: application/json

Body:
{
  "contents": [
    { "role": "user", "parts": [{ "text": "<systemPrompt>" }] },  // only include if provided
    { "role": "model", "parts": [{ "text": "Understood." }] },    // only include if systemPrompt provided
    { "role": "user", "parts": [{ "text": "<message>" }] }
  ],
  "generationConfig": {
    "maxOutputTokens": <maxTokens | 1024>
  }
}

Response field: response.candidates[0].content.parts[0].text
```

### xAI (Grok)

```
POST https://api.x.ai/v1/chat/completions
Headers:
  Authorization: Bearer <xAIAPIKey>
  Content-Type: application/json

Body:
{
  "model": "<model>",
  "messages": [
    { "role": "system", "content": "<systemPrompt>" },  // only include if provided
    { "role": "user", "content": "<message>" }
  ],
  "max_tokens": <maxTokens | 1024>
}

Response field: response.choices[0].message.content
```

---

## Error Handling

The endpoint should return appropriate HTTP status codes:

| Status | Condition                                           |
|--------|-----------------------------------------------------|
| 200    | Success - return the model's text response           |
| 400    | Unrecognized model prefix, missing required fields, or API key preference not configured |
| 401    | Invalid or missing Halix auth token                  |
| 502    | LLM provider returned an error (forward the provider's error message) |
| 500    | Unexpected server error                              |

When forwarding provider errors (502), include the provider's error message in the response body so SDK consumers can debug issues like invalid API keys or rate limits.

---

## CORS

This endpoint must include standard CORS headers to support browser-based SDK consumers. The existing Halix service CORS configuration should cover this since the endpoint is under the same service address.

---

## Supported Models (Current)

These are the models currently tested and validated in the SDK integration tests:

| Provider  | Models                                  |
|-----------|-----------------------------------------|
| Anthropic | `claude-opus-4-6`, `claude-sonnet-4-5`  |
| OpenAI    | `gpt-4.1`, `gpt-5.2`                   |
| Google    | `gemini-3-pro-preview`                  |
| xAI       | `grok-3`, `grok-3-mini-fast`            |

The endpoint should not be restricted to these models -- any model string matching the prefix rules should be forwarded to the appropriate provider. New models from providers will work automatically without endpoint changes.

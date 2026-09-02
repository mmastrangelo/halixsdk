// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.

/**
 * @module @halix/action-sdk/invocation
 * @description Authenticated browser invocation of server Actions through the
 * canonical Halix execution route.
 */

import axios from 'axios';
import { from, lastValueFrom, Observable } from 'rxjs';
import {
    actionRequestExecutor,
    actionSubject as initializedActionSubject,
    getAuthToken,
    sandboxKey,
    serviceAddress,
    userContext,
} from './sdk-general.js';

/** The verified browser-ingress duration bound for one synchronous invocation. */
export const MAX_ACTION_INVOCATION_TIMEOUT_MS = 55_000;

/** Options accepted by invokeAction. Proxy keys are untrusted hints and are
 * validated by the server against the current session and sandbox. */
export interface ActionInvocationOptions {
    /** Parameters made available to the invoked Action. Defaults to an empty object. */
    params?: Record<string, unknown>;
    /** Optional Action subject; defaults to the subject supplied to initialize(). */
    actionSubject?: unknown;
    /** Keys used by list-style Action contexts. */
    actionSubjectKeys?: string[];
    /** Optional compatibility payload forwarded as auxillaryData. */
    auxillaryData?: unknown;
    /** Organization proxy hint; defaults from initialized userContext. */
    orgProxyKey?: string;
    /** User proxy hint; defaults from initialized userContext. */
    userProxyKey?: string;
    /** Request timeout from 1 through the verified 55-second ingress bound. */
    timeoutMs?: number;
}

/** ActionResult is the server Action response with a typed single value or
 * updated subject when the selected response contract provides one. */
export type ActionResult<T> = {
    /** Platform response contract discriminator. */
    responseType: string;
    /** True when the Action reported a failure. */
    isError: boolean;
    /** Typed value from a single-value response. */
    value?: T;
    /** Typed updated subject from form, page, or object-save responses. */
    updatedSubject?: T;
    /** Typed calculated value from a calculated-field response. */
    calculatedValue?: T;
    /** Optional caller-facing success message. */
    successMessage?: string;
    /** Optional caller-facing error message. */
    errorMessage?: string;
    [key: string]: unknown;
};

/** ActionInvocationError normalizes transport, HTTP, Lambda, and Action-level
 * failures from invokeAction. */
export class ActionInvocationError extends Error {
    /** HTTP status when the failure came from an HTTP response. */
    readonly status?: number;
    /** Stable platform error code when supplied by the server. */
    readonly errorCode?: string;
    /** Raw response payload retained for caller diagnostics. */
    readonly response?: unknown;

    constructor(message: string, options?: {
        status?: number;
        errorCode?: string;
        response?: unknown;
        cause?: unknown;
    }) {
        super(message);
        this.name = 'ActionInvocationError';
        this.status = options?.status;
        this.errorCode = options?.errorCode;
        this.response = options?.response;
        if (options?.cause !== undefined) {
            Object.defineProperty(this, 'cause', {
                configurable: true,
                value: options.cause,
            });
        }
    }
}

/** Invokes a server Action once. The SDK never retries this POST because Action
 * handlers may have non-idempotent effects. */
export async function invokeAction<T>(
    actionRef: string,
    options: ActionInvocationOptions = {},
): Promise<ActionResult<T>> {
    if (!getAuthToken || !sandboxKey || !serviceAddress) {
        throw new ActionInvocationError('SDK not initialized.');
    }
    if (!actionRef?.trim()) {
        throw new ActionInvocationError('actionRef is required.');
    }

    const timeout = options.timeoutMs ?? MAX_ACTION_INVOCATION_TIMEOUT_MS;
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_ACTION_INVOCATION_TIMEOUT_MS) {
        throw new ActionInvocationError(
            `timeoutMs must be between 1 and ${MAX_ACTION_INVOCATION_TIMEOUT_MS}.`,
        );
    }

    const body = {
        userContext: {
            orgProxyKey: options.orgProxyKey ?? userContext?.orgProxyKey ?? '',
            userProxyKey: options.userProxyKey ?? userContext?.userProxyKey ?? '',
        },
        params: options.params ?? {},
        actionSubject: options.actionSubject ?? initializedActionSubject ?? null,
        actionSubjectKeys: options.actionSubjectKeys ?? [],
        auxillaryData: options.auxillaryData,
    };

    try {
        let result: ActionResult<T>;
        if (actionRequestExecutor) {
            result = await lastValueFrom(
                actionRequestExecutor(actionRef, body, timeout),
            ) as ActionResult<T>;
        } else {
            const authToken = await lastValueFrom(getAuthToken());
            const baseAddress = serviceAddress.replace(/\/+$/, '');
            const url =
                `${baseAddress}/actions/sandboxes/${encodeURIComponent(sandboxKey)}` +
                `/executeAction/${encodeURIComponent(actionRef)}`;
            const response = await axios.post<ActionResult<T>>(url, body, {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                },
                timeout,
                withCredentials: true,
            });
            result = response.data;
        }
        if (
            result?.responseType === 'error' ||
            result?.isError === true ||
            typeof result?.functionError === 'string'
        ) {
            throw actionResponseError(result);
        }
        return result;
    } catch (error) {
        if (error instanceof ActionInvocationError) {
            throw error;
        }
        const axiosError = error as {
            isAxiosError?: boolean;
            status?: number;
            error?: {
                message?: string;
                errorMessage?: string;
                errorCode?: string;
            };
            message?: string;
            response?: {
                status?: number;
                data?: {
                    message?: string;
                    errorMessage?: string;
                    errorCode?: string;
                };
            };
        };
        const errorResponse = axiosError.response?.data ?? axiosError.error;
        throw new ActionInvocationError(
            errorResponse?.message ??
            errorResponse?.errorMessage ??
            axiosError.message ??
            'Action invocation failed.',
            {
                status: axiosError.response?.status ?? axiosError.status,
                errorCode: errorResponse?.errorCode,
                response: errorResponse,
                cause: error,
            },
        );
    }
}

/** Observable wrapper for invokeAction with identical one-request and error semantics. */
export function invokeActionAsObservable<T>(
    actionRef: string,
    options: ActionInvocationOptions = {},
): Observable<ActionResult<T>> {
    return from(invokeAction<T>(actionRef, options));
}

function actionResponseError(result: ActionResult<unknown>): ActionInvocationError {
    const functionError = typeof result.functionError === 'string' ? result.functionError : '';
    const message =
        result.errorMessage ??
        functionError ??
        'Action returned an error response.';
    return new ActionInvocationError(message, {
        response: result,
    });
}

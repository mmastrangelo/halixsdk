import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { lastValueFrom } from 'rxjs';
import {
    ActionInvocationError,
    initialize,
    invokeAction,
    invokeActionAsObservable,
    MAX_ACTION_INVOCATION_TIMEOUT_MS,
} from '../src/index';

vi.mock('axios', () => {
    return {
        default: {
            post: vi.fn(),
        },
    } as any;
});

const mockedAxios = axios as unknown as {
    post: ReturnType<typeof vi.fn>;
};

function initializeBrowserContext() {
    initialize({
        sandboxKey: 'sbx~test',
        serviceAddress: 'https://svc/',
        actionSubject: { objKey: 'con~1' },
        userContext: {
            user: { objKey: 'usr~1' },
            userProxy: {},
            orgProxy: {},
            orgProxyKey: 'orgproxy~1',
            orgKey: 'org~1',
            userProxyKey: 'userproxy~1',
            navigationContext: {
                navigationKey: 'nav~1',
                navLevel: 'organization',
                userProxyElementId: 'contact',
                orgProxyElementId: 'business',
                userProxyRequired: true,
            },
        },
        params: {},
        authToken: 'TOKEN',
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    initializeBrowserContext();
});

describe('invokeAction', () => {
    it('posts once to the canonical route with default proxy hints and timeout', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                responseType: 'singleValueAction',
                isError: false,
                value: { count: 2 },
            },
        });

        const result = await invokeAction<{ count: number }>('mark duplicates', {
            params: { contactKey: 'con~1' },
        });

        expect(result.value?.count).toBe(2);
        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
        const [url, body, config] = mockedAxios.post.mock.calls[0];
        expect(url).toBe('https://svc/actions/sandboxes/sbx~test/executeAction/mark%20duplicates');
        expect(body.userContext).toEqual({
            orgProxyKey: 'orgproxy~1',
            userProxyKey: 'userproxy~1',
        });
        expect(body.params).toEqual({ contactKey: 'con~1' });
        expect(body.actionSubject).toEqual({ objKey: 'con~1' });
        expect(config.headers.Authorization).toBe('Bearer TOKEN');
        expect(config.timeout).toBe(MAX_ACTION_INVOCATION_TIMEOUT_MS);
        expect(config.withCredentials).toBe(true);
    });

    it('uses explicit proxy hints and defaults params to an empty object', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                responseType: 'singleValueAction',
                isError: false,
                value: 'ok',
            },
        });

        await invokeAction<string>('act~solution~run', {
            orgProxyKey: 'orgproxy~other',
            userProxyKey: 'userproxy~other',
        });

        const [, body] = mockedAxios.post.mock.calls[0];
        expect(body.userContext).toEqual({
            orgProxyKey: 'orgproxy~other',
            userProxyKey: 'userproxy~other',
        });
        expect(body.params).toEqual({});
    });

    it('provides an Observable with the same result', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                responseType: 'singleValueAction',
                isError: false,
                value: 42,
            },
        });

        const result = await lastValueFrom(invokeActionAsObservable<number>('answer'));

        expect(result.value).toBe(42);
        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('rejects responseType error responses without retrying', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                responseType: 'error',
                isError: true,
                errorMessage: 'function failed',
            },
        });

        await expect(invokeAction('failing-action')).rejects.toMatchObject({
            name: 'ActionInvocationError',
            message: 'function failed',
        });
        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('normalizes HTTP errors and preserves the server error code', async () => {
        mockedAxios.post.mockRejectedValueOnce({
            isAxiosError: true,
            message: 'Request failed',
            response: {
                status: 403,
                data: {
                    message: 'client invocation is disabled',
                    errorCode: 'ACTION_CLIENT_INVOKE_DISABLED',
                },
            },
        });

        await expect(invokeAction('private-action')).rejects.toMatchObject({
            name: 'ActionInvocationError',
            message: 'client invocation is disabled',
            status: 403,
            errorCode: 'ACTION_CLIENT_INVOKE_DISABLED',
        });
        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('rejects a timeout above the verified ingress bound before sending', async () => {
        await expect(invokeAction('slow-action', {
            timeoutMs: MAX_ACTION_INVOCATION_TIMEOUT_MS + 1,
        })).rejects.toBeInstanceOf(ActionInvocationError);

        expect(mockedAxios.post).not.toHaveBeenCalled();
    });
});

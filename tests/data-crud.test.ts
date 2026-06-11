import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { lastValueFrom } from 'rxjs';
import {
    initialize,
    getObject,
    getObjectAsObservable,
    getRelatedObjects,
    getRelatedObjectsAsObservable,
    getObjects,
    getObjectsAsObservable,
    saveObject,
    saveObjectAsObservable,
    saveRelatedObject,
    saveRelatedObjectAsObservable,
    deleteRelatedObject,
    deleteRelatedObjectAsObservable,
    deleteRelatedObjects,
    deleteRelatedObjectsAsObservable,
} from '../src/index';

vi.mock('axios', () => {
    return {
        default: {
            get: vi.fn(),
            post: vi.fn(),
            delete: vi.fn(),
        },
    } as any;
});

const mockedAxios = axios as unknown as {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
};

function initDefaults(overrides?: Partial<Parameters<typeof initialize>[0] & any>) {
    initialize({
        sandboxKey: 'sb',
        serviceAddress: 'https://svc',
        actionSubject: {},
        userContext: {
            user: { objKey: 'user1' },
            userProxy: {},
            orgProxy: { objType: 'Org' },
            orgProxyKey: 'scopeKeyPath123',
            orgKey: 'org1',
            userProxyKey: 'up1',
            navigationContext: {
                navigationKey: 'nav',
                orgProxyKey: 'scopeKeyPath123',
            },
        },
        params: {},
        authToken: 'TOKEN',
        ...(overrides || {}),
    } as any);
}

beforeEach(() => {
    vi.clearAllMocks();
    initDefaults();
});

describe('getObject / getObjectAsObservable', () => {
    it('calls axios.get with URL and headers and returns data', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { id: 'k1' } });
        const data = await getObject('el', 'k1', ['rel1', 'rel2']);
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        const [url, config] = mockedAxios.get.mock.calls[0];
        expect(url).toBe('https://svc/schema/sandboxes/sb/el/k1');
        expect(config.headers.Authorization).toBe('Bearer TOKEN');
        expect(String(config.params)).toContain('fetchedRelationships=rel1%2Crel2');
        expect(data).toEqual({ id: 'k1' });
    });
    
    it('observable wrapper resolves the same value', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { ok: true } });
        const value = await lastValueFrom(getObjectAsObservable('el', 'k2'));
        expect(value).toEqual({ ok: true });
    });
});

describe('getRelatedObjects / getRelatedObjectsAsObservable', () => {
    it('calls axios.get with filter and fetchedRelationships query', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: [{ id: 1 }] });
        const data = await getRelatedObjects('parent', 'pkey', 'child', 'age>10', ['r1']);
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        const [url, config] = mockedAxios.get.mock.calls[0];
        expect(url).toBe('https://svc/schema/sandboxes/sb/parent/pkey/child');
        const qs = String(config.params);
        expect(qs).toContain('filter=age%3E10');
        expect(qs).toContain('fetchedRelationships=r1');
        expect(data).toEqual([{ id: 1 }]);
    });
    
    it('observable wrapper resolves the same array', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: [1, 2, 3] });
        const arr = await lastValueFrom(getRelatedObjectsAsObservable('p', 'k', 'e'));
        expect(arr).toEqual([1, 2, 3]);
    });
});

describe('getObjects / getObjectsAsObservable', () => {
    it('calls scoped objects endpoint with keys query', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: [{ objKey: 'k1' }] });
        const data = await getObjects('el', ['k1', 'k2']);
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        const [url, config] = mockedAxios.get.mock.calls[0];
        expect(url).toBe('https://svc/schema/sandboxes/sb/el');
        expect(String(config.params)).toContain('keys=k1%2Ck2');
        expect(config.headers.Authorization).toBe('Bearer TOKEN');
        expect(data).toEqual([{ objKey: 'k1' }]);
    });

    it('passes filter and fetchedRelationships with keys', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: [{ objKey: 'k1' }] });
        await getObjects('el', ['k1', 'k2'], 'status=="Active"', ['rel1', 'rel2']);
        const [, config] = mockedAxios.get.mock.calls[0];
        const qs = String(config.params);
        expect(qs).toContain('filter=status%3D%3D%22Active%22');
        expect(qs).toContain('fetchedRelationships=rel1%2Crel2');
        expect(qs).toContain('keys=k1%2Ck2');
    });

    it('passes applyContext with keys', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: [{ objKey: 'k1' }] });
        await getObjects('el', ['k1'], undefined, undefined, true);
        const [, config] = mockedAxios.get.mock.calls[0];
        expect(String(config.params)).toContain('applyContext=');
        expect(String(config.params)).toContain('nav');
        expect(String(config.params)).toContain('up1');
        expect(String(config.params)).toContain('scopeKeyPath123');
    });

    it('observable wrapper resolves the same array', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: [{ objKey: 'k1' }] });
        const arr = await lastValueFrom(getObjectsAsObservable('el', ['k1']));
        expect(arr).toEqual([{ objKey: 'k1' }]);
    });
});

describe('saveObject / saveObjectAsObservable', () => {
    it('posts object bodies with bypassValidation=true by default', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { saved: true } });
        const body = { a: 1 };
        const result = await saveObject('el', body);
        const [url, postedBody, config] = mockedAxios.post.mock.calls[0];
        expect(url).toBe('https://svc/schema/sandboxes/sb/el?bypassValidation=true');
        expect(postedBody).toBe(body);
        expect(config.headers.Authorization).toBe('Bearer TOKEN');
        expect(result).toEqual({ saved: true });
    });

    it('posts string bodies with bypassValidation=false when explicitly set', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { saved: true } });
        await saveObject('el', '{"a":1}', { bypassValidation: false });
        const [url, body] = mockedAxios.post.mock.calls[0];
        expect(url).toBe('https://svc/schema/sandboxes/sb/el?bypassValidation=false');
        expect(body).toBe('{"a":1}');
    });

    it('includes fetchedRelationships when provided', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { saved: true } });
        await saveObject('el', { a: 1 }, { fetchedRelationships: ['r1', 'r2'] });
        const [url] = mockedAxios.post.mock.calls[0];
        expect(url).toBe('https://svc/schema/sandboxes/sb/el?bypassValidation=true&fetchedRelationships=r1%2Cr2');
    });

    it('observable wrapper resolves saved object', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { saved: 'ok' } });
        const res = await lastValueFrom(saveObjectAsObservable('e', { a: 1 }));
        expect(res).toEqual({ saved: 'ok' });
    });
});

describe('saveRelatedObject / saveRelatedObjectAsObservable', () => {
    it('posts with bypassValidation=true by default', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { saved: true } });
        const body = { a: 1 };
        const result = await saveRelatedObject('p', 'pk', 'el', body);
        const [url, postedBody, config] = mockedAxios.post.mock.calls[0];
        expect(url).toBe('https://svc/schema/sandboxes/sb/p/pk/el?bypassValidation=true');
        expect(postedBody).toBe(body);
        expect(config.headers.Authorization).toBe('Bearer TOKEN');
        expect(result).toEqual({ saved: true });
    });
    
    it('posts with bypassValidation=false when explicitly set', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { saved: true } });
        await saveRelatedObject('p', 'pk', 'el', 'x', { bypassValidation: false });
        const [url] = mockedAxios.post.mock.calls[0];
        expect(url).toBe('https://svc/schema/sandboxes/sb/p/pk/el?bypassValidation=false');
    });

    it('includes fetchedRelationships when provided', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { saved: true } });
        await saveRelatedObject('p', 'pk', 'el', { a: 1 }, { fetchedRelationships: ['r1', 'r2'] });
        const [url] = mockedAxios.post.mock.calls[0];
        expect(url).toBe('https://svc/schema/sandboxes/sb/p/pk/el?bypassValidation=true&fetchedRelationships=r1%2Cr2');
    });
    
    it('observable wrapper resolves saved object', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { saved: 'ok' } });
        const res = await lastValueFrom(saveRelatedObjectAsObservable('p', 'k', 'e', 'y'));
        expect(res).toEqual({ saved: 'ok' });
    });
});

describe('deleteRelatedObject(s)', () => {
    it('returns true when single delete yields 204', async () => {
        mockedAxios.delete.mockResolvedValueOnce({ status: 204 });
        const ok = await deleteRelatedObject('p', 'pk', 'c', 'ck');
        const [url, config] = mockedAxios.delete.mock.calls[0];
        expect(url).toBe('https://svc/schema/sandboxes/sb/p/pk/c/ck');
        expect(config.headers.Authorization).toBe('Bearer TOKEN');
        expect(ok).toBe(true);
    });
    
    it('returns false when single delete yields non-204', async () => {
        mockedAxios.delete.mockResolvedValueOnce({ status: 200 });
        const ok = await deleteRelatedObject('p', 'pk', 'c', 'ck');
        expect(ok).toBe(false);
    });
    
    it('observable wrapper resolves boolean for single delete', async () => {
        mockedAxios.delete.mockResolvedValueOnce({ status: 204 });
        const ok = await lastValueFrom(deleteRelatedObjectAsObservable('p', 'pk', 'c', 'ck'));
        expect(ok).toBe(true);
    });
    
    it('bulk delete passes keys param and returns true on 204', async () => {
        mockedAxios.delete.mockResolvedValueOnce({ status: 204 });
        const ok = await deleteRelatedObjects('p', 'pk', 'c', ['a', 'b']);
        const [url, config] = mockedAxios.delete.mock.calls[0];
        expect(url).toBe('https://svc/schema/sandboxes/sb/p/pk/c');
        expect(config.params.keys).toBe('a,b');
        expect(ok).toBe(true);
    });
    
    it('observable wrapper resolves boolean for bulk delete', async () => {
        mockedAxios.delete.mockResolvedValueOnce({ status: 204 });
        const ok = await lastValueFrom(deleteRelatedObjectsAsObservable('p', 'pk', 'c', ['a']));
        expect(ok).toBe(true);
    });
});

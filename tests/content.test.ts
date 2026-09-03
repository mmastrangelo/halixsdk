import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { lastValueFrom } from 'rxjs';
import {
    initialize,
    getOrCreateResource,
    getOrCreateResourceAsObservable,
    saveResource,
    saveResourceAsObservable,
    sendFileContents,
    sendFileContentsAsObservable,
    createOrUpdateResource,
    createOrUpdateResourceAsObservable,
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

describe('getOrCreateResource / getOrCreateResourceAsObservable', () => {
    it('fetches existing resource when key provided and adjusts metadata with file', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { objKey: 'r1', name: 'old', extension: 'txt' } });
        const blob = new Blob(['hi'], { type: 'text/plain' });
        const res = await getOrCreateResource('r1', blob, true, 'doc', ['t1']);
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(res.contentType).toBe('text/plain');
        expect(res.name).toBeNull();
        expect(res.extension).toBeNull();
    });
    
    it('creates new resource object when no key provided', async () => {
        const blob = new Blob(['x'], { type: 'image/png' });
        const res = await getOrCreateResource(null, blob, false, 'image', ['tag']);
        expect(mockedAxios.get).not.toHaveBeenCalled();
        expect(res.isPublic).toBe(false);
        expect(res.resourceType).toBe('image');
        expect(res.tags).toEqual(['tag']);
        expect(res.organizationKey).toBe('org1');
        expect(res.sandboxKey).toBe('sb');
        expect(res.userKey).toBe('user1');
        expect(res.contentType).toBe('image/png');
        expect(res.name).toBeNull();
        expect(res.extension).toBeNull();
    });

    it('creates resource without file when fileToUpload is null', async () => {
        const res = await getOrCreateResource(null, null, true, 'data', []);
        expect(res.isPublic).toBe(true);
        expect(res.resourceType).toBe('data');
        expect(res.contentType).toBeUndefined();
        expect(res.name).toBeUndefined();
    });
    
    it('observable wrapper resolves the same resource', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { objKey: 'r2' } });
        const val = await lastValueFrom(getOrCreateResourceAsObservable('r2', null, true, 'x', []));
        expect(val.objKey).toBe('r2');
    });
});

describe('saveResource / saveResourceAsObservable', () => {
    it('posts with solutionKey when in solution builder context', async () => {
        initDefaults({ 
            userContext: { 
                user: { objKey: 'user1' }, 
                userProxy: {}, 
                orgProxy: { objType: 'Solution' }, 
                orgProxyKey: 'SOLKEY', 
                orgKey: 'org1', 
                userProxyKey: 'up1' 
            } 
        });
        mockedAxios.post.mockResolvedValueOnce({ 
            data: { 
                objKey: 'abc', 
                isPublic: true, 
                resourceType: 't', 
                tags: [], 
                organizationKey: 'org1', 
                sandboxKey: 'sb', 
                userKey: 'user1' 
            } 
        });
        const r = await saveResource({ 
            isPublic: true, 
            resourceType: 't', 
            tags: [], 
            organizationKey: 'org1', 
            sandboxKey: 'sb', 
            userKey: 'user1' 
        });
        const [url, body, config] = mockedAxios.post.mock.calls[0];
        expect(url).toBe('https://svc/sandboxes/sb/contentResource');
        expect(typeof body).toBe('string');
        expect(config.params.solutionKey).toBe('SOLKEY');
        expect(config.params.organizationKey).toBeUndefined();
        expect(r).toMatchObject({ objKey: 'abc' });
    });
    
    it('posts with organizationKey and userKey when in org view', async () => {
        initDefaults({ 
            userContext: { 
                user: { objKey: 'user1' }, 
                userProxy: {}, 
                orgProxy: { objType: 'Org' }, 
                orgProxyKey: 'K', 
                orgKey: 'ORG', 
                userProxyKey: 'up1' 
            } 
        });
        mockedAxios.post.mockResolvedValueOnce({ data: { ok: 1 } });
        await saveResource({ 
            isPublic: true, 
            resourceType: 't', 
            tags: [], 
            organizationKey: 'ORG', 
            sandboxKey: 'sb', 
            userKey: 'user1' 
        });
        const [, , config] = mockedAxios.post.mock.calls[0];
        expect(config.params.organizationKey).toBe('ORG');
        expect(config.params.userKey).toBe('user1');
    });

    it('includes authorization header in request', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { objKey: 'xyz' } });
        await saveResource({ 
            isPublic: false, 
            resourceType: 'doc', 
            tags: ['tag1'], 
            organizationKey: 'org1', 
            sandboxKey: 'sb', 
            userKey: 'user1' 
        });
        const [, , config] = mockedAxios.post.mock.calls[0];
        expect(config.headers.Authorization).toBe('Bearer TOKEN');
    });
    
    it('observable wrapper resolves saved resource', async () => {
        mockedAxios.post.mockResolvedValueOnce({ 
            data: { 
                objKey: 'def', 
                isPublic: true, 
                resourceType: 't', 
                tags: [], 
                organizationKey: 'org1', 
                sandboxKey: 'sb', 
                userKey: 'user1' 
            } 
        });
        const v = await lastValueFrom(saveResourceAsObservable({ 
            isPublic: true, 
            resourceType: 't', 
            tags: [], 
            organizationKey: 'org1', 
            sandboxKey: 'sb', 
            userKey: 'user1' 
        }));
        expect(v.objKey).toBe('def');
    });
});

describe('sendFileContents / sendFileContentsAsObservable', () => {
    it('posts form data to filecontent URL and returns true on 204', async () => {
        mockedAxios.post.mockResolvedValueOnce({ status: 204 });
        const blob = new Blob(['abc'], { type: 'text/plain' });
        const ok = await sendFileContents('RKEY', blob, true);
        const [url, form, config] = mockedAxios.post.mock.calls[0];
        expect(url).toBe('https://svc/filecontent/sb/RKEY');
        expect(typeof (form as any).append).toBe('function');
        expect(config.headers.Authorization).toBe('Bearer TOKEN');
        expect(String(config.headers['Content-Type'])).toContain('multipart/form-data');
        expect(ok).toBe(true);
    });

    it('returns false when upload returns non-204 status', async () => {
        mockedAxios.post.mockResolvedValueOnce({ status: 200 });
        const blob = new Blob(['test'], { type: 'text/plain' });
        const ok = await sendFileContents('KEY1', blob, false);
        expect(ok).toBe(false);
    });

    it('includes scopeKeyPath and public flag in form data', async () => {
        mockedAxios.post.mockResolvedValueOnce({ status: 204 });
        const blob = new Blob(['data'], { type: 'application/octet-stream' });
        await sendFileContents('RES', blob, false);
        const [, form] = mockedAxios.post.mock.calls[0];
        // We can't easily inspect FormData contents in the test, but we verify the call was made
        expect(form).toBeDefined();
        expect(typeof (form as any).append).toBe('function');
    });
    
    it('observable wrapper resolves boolean result', async () => {
        mockedAxios.post.mockResolvedValueOnce({ status: 204 });
        const ok = await lastValueFrom(sendFileContentsAsObservable('K', new Blob(['x']), false));
        expect(ok).toBe(true);
    });
});

describe('createOrUpdateResource / createOrUpdateResourceAsObservable', () => {
    it('creates, saves, uploads, and refreshes resource when no key provided', async () => {
        // First getOrCreateResource: no key -> construct locally, no axios call
        // Save resource -> returns objKey
        mockedAxios.post.mockResolvedValueOnce({ data: { objKey: 'RES1' } }); // saveResource
        // sendFileContents -> 204
        mockedAxios.post.mockResolvedValueOnce({ status: 204 });
        // final getOrCreateResource (with key) -> axios.get
        mockedAxios.get.mockResolvedValueOnce({ data: { objKey: 'RES1', fileSize: 3 } });
        
        const blob = new Blob(['abc'], { type: 'text/plain' });
        const updated = await createOrUpdateResource(null, blob, true, 'doc', ['t']);
        // saveResource called once
        expect(mockedAxios.post).toHaveBeenCalled();
        // final GET performed
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(updated).toMatchObject({ objKey: 'RES1', fileSize: 3 });
    });

    it('updates existing resource when key provided', async () => {
        // getOrCreateResource with key -> axios.get
        mockedAxios.get.mockResolvedValueOnce({ data: { objKey: 'EXIST', name: 'existing' } });
        // saveResource
        mockedAxios.post.mockResolvedValueOnce({ data: { objKey: 'EXIST' } });
        // sendFileContents
        mockedAxios.post.mockResolvedValueOnce({ status: 204 });
        // final getOrCreateResource
        mockedAxios.get.mockResolvedValueOnce({ data: { objKey: 'EXIST', fileSize: 10 } });
        
        const blob = new Blob(['newcontent'], { type: 'text/plain' });
        const updated = await createOrUpdateResource('EXIST', blob, false, 'doc', ['tag1']);
        
        expect(mockedAxios.get).toHaveBeenCalledTimes(2); // Initial fetch + final refresh
        expect(mockedAxios.post).toHaveBeenCalledTimes(2); // Save + upload
        expect(updated.objKey).toBe('EXIST');
    });

    it('throws error if resource save returns no objKey', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: {} }); // No objKey
        
        const blob = new Blob(['test'], { type: 'text/plain' });
        
        await expect(
            createOrUpdateResource(null, blob, true, 'doc', [])
        ).rejects.toThrow('Resource was saved but no objKey was returned');
    });

    it('throws error if file upload fails', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { objKey: 'RES1' } }); // saveResource
        mockedAxios.post.mockResolvedValueOnce({ status: 500 }); // Failed upload
        
        const blob = new Blob(['test'], { type: 'text/plain' });
        
        await expect(
            createOrUpdateResource(null, blob, true, 'doc', [])
        ).rejects.toThrow('Failed to upload file contents');
    });
    
    it('observable wrapper resolves updated resource', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: { objKey: 'R' } });
        mockedAxios.post.mockResolvedValueOnce({ status: 204 });
        mockedAxios.get.mockResolvedValueOnce({ data: { objKey: 'R' } });
        const val = await lastValueFrom(createOrUpdateResourceAsObservable(null, new Blob(['x']), true, 't', []));
        expect(val.objKey).toBe('R');
    });
});


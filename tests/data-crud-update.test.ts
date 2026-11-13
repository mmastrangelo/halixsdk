import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { lastValueFrom } from 'rxjs';
import {
    initialize,
    updateObject,
    updateObjectAsObservable,
    UpdateConflictError,
    UpdateOutcomeUnknownError,
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
};

const READ_URL = 'https://svc/schema/sandboxes/sb/raffle/r1';
const SAVE_URL = 'https://svc/schema/sandboxes/sb/raffle?bypassValidation=true&applyContext=nav%7Cup1%7CscopeKeyPath123';

/** A read response for the record at the given version. */
function read(next: number, version: string) {
    return { data: { objKey: 'r1', next }, headers: { 'x-halix-record-version': version } };
}

/** The service's refusal of a save whose record changed since it was read. */
function changed() {
    return { response: { status: 400, data: { errorCode: 'ModifiedSinceLastOpenedError' } } };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    // No wait between attempts.
    vi.spyOn(Math, 'random').mockReturnValue(0);
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
    } as any);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('updateObject / updateObjectAsObservable', () => {
    it('reads the record, applies the change and saves against the version it read', async () => {
        mockedAxios.get.mockResolvedValueOnce(read(5, '1700'));
        mockedAxios.post.mockResolvedValueOnce({ data: { objKey: 'r1', next: 8 } });

        const saved = await updateObject('raffle', 'r1', (raffle: any) => {
            raffle.next += 3;
            return raffle;
        });

        const [readUrl, readConfig] = mockedAxios.get.mock.calls[0];
        expect(readUrl).toBe(READ_URL);
        expect(readConfig.headers.Authorization).toBe('Bearer TOKEN');

        const [saveUrl, body, saveConfig] = mockedAxios.post.mock.calls[0];
        expect(saveUrl).toBe(SAVE_URL);
        expect(body).toEqual({ objKey: 'r1', next: 8 });
        expect(saveConfig.headers.Authorization).toBe('Bearer TOKEN');
        expect(saveConfig.headers['X-Halix-Record-Version']).toBe('1700');
        expect(saved).toEqual({ objKey: 'r1', next: 8 });
    });

    it('saves a record changed in place when the change returns nothing, and always sends its key', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { next: 5 }, headers: { 'X-Halix-Record-Version': '9' } });
        mockedAxios.post.mockResolvedValueOnce({ data: {} });

        await updateObject('raffle', 'r1', (raffle: any) => { raffle.next = 6; });

        const [, body, config] = mockedAxios.post.mock.calls[0];
        expect(body).toEqual({ objKey: 'r1', next: 6 });
        expect(config.headers['X-Halix-Record-Version']).toBe('9');
    });

    it('reads again and applies the change to the newer record when another writer saved first', async () => {
        mockedAxios.get.mockResolvedValueOnce(read(5, '1')).mockResolvedValueOnce(read(7, '2'));
        mockedAxios.post.mockRejectedValueOnce(changed()).mockResolvedValueOnce({ data: { objKey: 'r1', next: 10 } });

        const seen: number[] = [];
        const saved = await updateObject('raffle', 'r1', (raffle: any) => {
            seen.push(raffle.next);
            return { ...raffle, next: raffle.next + 3 };
        });

        expect(seen).toEqual([5, 7]);
        expect(mockedAxios.post.mock.calls[1][1]).toEqual({ objKey: 'r1', next: 10 });
        expect(mockedAxios.post.mock.calls[1][2].headers['X-Halix-Record-Version']).toBe('2');
        expect(saved.next).toBe(10);
    });

    it('throws UpdateConflictError after maxAttempts conflicts', async () => {
        mockedAxios.get.mockResolvedValue(read(5, '1'));
        mockedAxios.post.mockRejectedValue(changed());

        const failure = await updateObject('raffle', 'r1', (raffle: any) => raffle, { maxAttempts: 3 }).catch(e => e);

        expect(failure).toBeInstanceOf(UpdateConflictError);
        expect(failure.attempts).toBe(3);
        expect(mockedAxios.get).toHaveBeenCalledTimes(3);
        expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('stops with UpdateConflictError when the time allowed runs out', async () => {
        let now = 1000;
        vi.spyOn(Date, 'now').mockImplementation(() => now);
        mockedAxios.get.mockResolvedValue(read(5, '1'));
        mockedAxios.post.mockImplementation(async () => {
            now += 600;
            throw changed();
        });

        const failure = await updateObject('raffle', 'r1', (raffle: any) => raffle, { timeoutMs: 1000 }).catch(e => e);

        expect(failure).toBeInstanceOf(UpdateConflictError);
        expect(failure.attempts).toBe(2);
        // Each request is limited to what is left of the time allowed.
        expect(mockedAxios.get.mock.calls[0][1].timeout).toBe(1000);
        expect(mockedAxios.get.mock.calls[1][1].timeout).toBe(400);
        expect(mockedAxios.post.mock.calls[1][2].timeout).toBe(400);
    });

    it('saves nothing when the change throws', async () => {
        mockedAxios.get.mockResolvedValueOnce(read(5, '1'));

        await expect(updateObject('raffle', 'r1', () => { throw new Error('Sold out'); })).rejects.toThrow('Sold out');

        expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('does not retry a save that got no answer', async () => {
        mockedAxios.get.mockResolvedValue(read(5, '1'));
        const dropped = new Error('socket hang up');
        mockedAxios.post.mockRejectedValueOnce(dropped);

        const failure = await updateObject('raffle', 'r1', (raffle: any) => raffle).catch(e => e);

        expect(failure).toBeInstanceOf(UpdateOutcomeUnknownError);
        expect(failure.cause).toBe(dropped);
        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('rethrows any other refusal from the service without retrying', async () => {
        mockedAxios.get.mockResolvedValue(read(5, '1'));
        const refused = { response: { status: 400, data: { errorCode: 'ValidationError' } } };
        mockedAxios.post.mockRejectedValueOnce(refused);

        await expect(updateObject('raffle', 'r1', (raffle: any) => raffle)).rejects.toBe(refused);

        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('refuses to save when the service returns no record version', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { objKey: 'r1', next: 5 }, headers: {} });

        await expect(updateObject('raffle', 'r1', (raffle: any) => raffle)).rejects.toThrow('no record version');

        expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('reads the version through a headers object with a get method', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: { objKey: 'r1', next: 5 },
            headers: { get: (name: string) => (name === 'X-Halix-Record-Version' ? '42' : undefined) },
        });
        mockedAxios.post.mockResolvedValueOnce({ data: {} });

        await updateObject('raffle', 'r1', (raffle: any) => raffle);

        expect(mockedAxios.post.mock.calls[0][2].headers['X-Halix-Record-Version']).toBe('42');
    });

    it('rejects settings that are out of range before reading', async () => {
        await expect(updateObject('raffle', 'r1', (r: any) => r, { maxAttempts: 0 })).rejects.toThrow('maxAttempts');
        await expect(updateObject('raffle', 'r1', (r: any) => r, { timeoutMs: 0 })).rejects.toThrow('timeoutMs');
        expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('passes the save options through to the save', async () => {
        mockedAxios.get.mockResolvedValueOnce(read(5, '1'));
        mockedAxios.post.mockResolvedValueOnce({ data: {} });

        await updateObject('raffle', 'r1', (raffle: any) => raffle, { bypassValidation: false, fetchedRelationships: ['tickets'] });

        expect(mockedAxios.post.mock.calls[0][0]).toBe('https://svc/schema/sandboxes/sb/raffle?bypassValidation=false&fetchedRelationships=tickets&applyContext=nav%7Cup1%7CscopeKeyPath123');
    });

    it('observable wrapper resolves the saved object', async () => {
        mockedAxios.get.mockResolvedValueOnce(read(5, '1'));
        mockedAxios.post.mockResolvedValueOnce({ data: { objKey: 'r1', next: 6 } });

        const saved = await lastValueFrom(updateObjectAsObservable('raffle', 'r1', (raffle: any) => ({ ...raffle, next: 6 })));

        expect(saved).toEqual({ objKey: 'r1', next: 6 });
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import { lastValueFrom } from 'rxjs';
import {
    canDeleteDataElement,
    canReadDataElement,
    canWriteDataElement,
    dataElementAccess,
    dataElementAccessAsObservable,
    hasBusinessPrivilege,
    hasDataElementAccess,
    hasDataElementAccessAsObservable,
    hasBusinessPrivilegeAsObservable,
    initialize,
    inviteOrLinkUserProxyByEmail,
    linkUserProxy,
    linkUserProxyAsObservable,
    listUserProxyAccessRoster,
    setUserProxyRosterRoles,
    userPrivileges,
    userPrivilegesAsObservable,
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

function initDefaults() {
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
    } as any);
}

beforeEach(() => {
    vi.clearAllMocks();
    initDefaults();
});

describe('business privilege checks', () => {
    it('checks business privilege access through the server', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: { businessPrivilegeId: 'manageSharedLists', hasPrivilege: false },
        });

        const result = await hasBusinessPrivilege('manageSharedLists');

        expect(result).toBe(false);
        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://svc/access/sandboxes/sb/businessPrivileges/manageSharedLists/currentUserHasPrivilege',
            {
                headers: { Authorization: 'Bearer TOKEN' },
            },
        );
    });

    it('encodes privilege ids when checking server access', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: { businessPrivilegeId: 'manage shared lists', hasPrivilege: true },
        });

        await hasBusinessPrivilege('manage shared lists');

        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://svc/access/sandboxes/sb/businessPrivileges/manage%20shared%20lists/currentUserHasPrivilege',
            expect.any(Object),
        );
    });

    it('observable privilege check resolves the same server value', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: { businessPrivilegeId: 'manageSharedLists', hasPrivilege: true },
        });

        const result = await lastValueFrom(hasBusinessPrivilegeAsObservable('manageSharedLists'));

        expect(result).toBe(true);
    });
});

describe('current user privileges', () => {
    it('loads current user privileges through the server', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: { businessPrivileges: ['manageSharedLists'] },
        });

        const result = await userPrivileges();

        expect(result).toEqual(['manageSharedLists']);
        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://svc/access/sandboxes/sb/currentBusinessPrivileges',
            {
                headers: { Authorization: 'Bearer TOKEN' },
            },
        );
    });

    it('does not trust locally initialized privilege context', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: { businessPrivileges: [] },
        });

        const result = await userPrivileges();

        expect(result).toEqual([]);
    });

    it('accepts raw current user privilege arrays from server', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: ['manageSharedLists'],
        });

        const result = await userPrivileges();

        expect(result).toEqual(['manageSharedLists']);
    });

    it('observable current privileges resolve the same server list', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: { businessPrivileges: ['manageSharedLists'] },
        });

        const result = await lastValueFrom(userPrivilegesAsObservable());

        expect(result).toEqual(['manageSharedLists']);
    });
});

describe('user proxy linking', () => {
    it('links an existing user to an existing user proxy with role object keys', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: undefined });

        await linkUserProxy({
            userKey: 'usr~00~existing',
            userProxyElementId: 'familyMember',
            userProxyKey: 'fam~00~member~1',
            roleKeys: ['rol~00~member', 'rol~00~admin'],
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://svc/access/sandboxes/sb/userProxy/fam~00~member~1/familyMember/linkProxy?userKey=usr~00~existing&roleKeys=rol~00~member,rol~00~admin',
            null,
            {
                headers: { Authorization: 'Bearer TOKEN' },
            },
        );
    });

    it('encodes link request path and query values', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: undefined });

        await linkUserProxy({
            userKey: 'usr key',
            userProxyElementId: 'family member',
            userProxyKey: 'fam/key',
            roleKeys: ['role key'],
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://svc/access/sandboxes/sb/userProxy/fam%2Fkey/family%20member/linkProxy?userKey=usr%20key&roleKeys=role%20key',
            null,
            expect.any(Object),
        );
    });

    it('observable link user proxy resolves after server call', async () => {
        mockedAxios.post.mockResolvedValueOnce({ data: undefined });

        await expect(lastValueFrom(linkUserProxyAsObservable({
            userKey: 'usr~00~existing',
            userProxyElementId: 'familyMember',
            userProxyKey: 'fam~00~member~1',
            roleKeys: ['rol~00~member'],
        }))).resolves.toBeUndefined();
    });
});

describe('user proxy access roster', () => {
    it('loads access-enriched roster rows for an org proxy context', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: [{ userProxy: { objKey: 'fam~member' }, hasAccess: true }],
        });

        const result = await listUserProxyAccessRoster('fam~family', 'family', 'familyMember');

        expect(result).toEqual([{ userProxy: { objKey: 'fam~member' }, hasAccess: true }]);
        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://svc/access/sandboxes/sb/userProxyRoster/fam~family/family/familyMember',
            {
                headers: { Authorization: 'Bearer TOKEN' },
            },
        );
    });

    it('invites or links by email through the roster endpoint', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                action: 'alreadyLinked',
                rolesUpdated: true,
                row: { userProxy: { objKey: 'fam~member' }, hasAccess: true },
            },
        });

        const result = await inviteOrLinkUserProxyByEmail('fam~family', 'family', 'familyMember', {
            email: 'person@example.com',
            firstName: 'Person',
            roleKeys: ['rol~member'],
        });

        expect(result.action).toBe('alreadyLinked');
        expect(result.rolesUpdated).toBe(true);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://svc/access/sandboxes/sb/userProxyRoster/fam~family/family/familyMember/inviteOrLink',
            {
                email: 'person@example.com',
                firstName: 'Person',
                roleKeys: ['rol~member'],
            },
            {
                headers: { Authorization: 'Bearer TOKEN' },
            },
        );
    });

    it('sets roster roles and encodes path values', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: { userProxy: { objKey: 'fam/key' }, hasAccess: true, roleKeys: ['rol key'] },
        });

        const result = await setUserProxyRosterRoles('fam/family', 'family type', 'family member', 'fam/key', {
            roleKeys: ['rol key'],
        });

        expect(result.roleKeys).toEqual(['rol key']);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://svc/access/sandboxes/sb/userProxyRoster/fam%2Ffamily/family%20type/family%20member/proxy/fam%2Fkey/roles',
            {
                roleKeys: ['rol key'],
            },
            {
                headers: { Authorization: 'Bearer TOKEN' },
            },
        );
    });
});

describe('data element access checks', () => {
    it('checks data element access through the server', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                dataElementId: 'shoppingList',
                dataElementKey: 'dlm~00~test~shoppingList',
                canRead: true,
                canWrite: false,
                canDelete: false,
            },
        });

        const result = await dataElementAccess('shoppingList');

        expect(result).toEqual({
            dataElementId: 'shoppingList',
            dataElementKey: 'dlm~00~test~shoppingList',
            canRead: true,
            canWrite: false,
            canDelete: false,
        });
        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://svc/access/sandboxes/sb/dataElements/shoppingList/currentUserAccess',
            {
                headers: { Authorization: 'Bearer TOKEN' },
            },
        );
    });

    it('encodes data element ids when checking server access', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: {
                dataElementId: 'shopping list',
                dataElementKey: 'dlm~00~test~shoppingList',
                canRead: true,
                canWrite: true,
                canDelete: false,
            },
        });

        await dataElementAccess('shopping list');

        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://svc/access/sandboxes/sb/dataElements/shopping%20list/currentUserAccess',
            expect.any(Object),
        );
    });

    it('checks individual data element access modes', async () => {
        mockedAxios.get.mockResolvedValue({
            data: {
                dataElementId: 'shoppingList',
                dataElementKey: 'dlm~00~test~shoppingList',
                canRead: true,
                canWrite: true,
                canDelete: false,
            },
        });

        await expect(hasDataElementAccess('shoppingList', 'read')).resolves.toBe(true);
        await expect(hasDataElementAccess('shoppingList', 'write')).resolves.toBe(true);
        await expect(hasDataElementAccess('shoppingList', 'delete')).resolves.toBe(false);
    });

    it('exposes convenience helpers for read write and delete checks', async () => {
        mockedAxios.get.mockResolvedValue({
            data: {
                dataElementId: 'shoppingList',
                dataElementKey: 'dlm~00~test~shoppingList',
                canRead: true,
                canWrite: false,
                canDelete: true,
            },
        });

        await expect(canReadDataElement('shoppingList')).resolves.toBe(true);
        await expect(canWriteDataElement('shoppingList')).resolves.toBe(false);
        await expect(canDeleteDataElement('shoppingList')).resolves.toBe(true);
    });

    it('observable data element checks resolve the same server values', async () => {
        mockedAxios.get.mockResolvedValue({
            data: {
                dataElementId: 'shoppingList',
                dataElementKey: 'dlm~00~test~shoppingList',
                canRead: true,
                canWrite: true,
                canDelete: false,
            },
        });

        await expect(lastValueFrom(dataElementAccessAsObservable('shoppingList'))).resolves.toEqual({
            dataElementId: 'shoppingList',
            dataElementKey: 'dlm~00~test~shoppingList',
            canRead: true,
            canWrite: true,
            canDelete: false,
        });
        await expect(lastValueFrom(hasDataElementAccessAsObservable('shoppingList', 'delete'))).resolves.toBe(false);
    });
});

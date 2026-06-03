// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/access
 * @description Access, roles, business privileges, invitations, and user scope assignment for the Halix Platform action SDK.
 * This module lets custom code inspect role and privilege metadata, invite users, and update a user's access inside the
 * current sandbox.
 *
 * Key concepts:
 * - `Role.id` is the stable semantic role identifier used by configuration and generated code.
 * - `Role.objKey` is the persisted role object key. APIs that accept `roleKeys` require `Role.objKey`, not `Role.id`.
 * - `BusinessPrivilege.id` is the stable privilege identifier used by server-validated checks such as `hasBusinessPrivilege`.
 * - Data element access checks use stable data element IDs and resolve to persisted keys on the server.
 * - `ScopeKeyItem` entries define the data scope a user receives for an organization, user proxy, or custom data scope.
 * - `linkUserProxy` links an existing platform user (`userKey`) to an existing unlinked user proxy record.
 * - `listUserProxyAccessRoster` and `inviteOrLinkUserProxyByEmail` are the standard user-access page helpers. They use
 *   the access service to join shared user proxy identity records with current-sandbox login, invite, scope, and role
 *   state. Do not infer current-solution access from shared proxy records alone.
 *
 * @usage
 * ## When to Use
 * - **Build role assignment UI** -> `listRoles`, then submit matching `role.objKey` values as `roleKeys`
 * - **Show or check business privileges** -> `listBusinessPrivileges`, `hasBusinessPrivilege`, `userPrivileges`
 * - **List users in the current sandbox** -> `listSandboxUsers`
 * - **Inspect one user's access** -> `getUserAccess`
 * - **Invite or link a user by email** -> `inviteOrLinkUserProxyByEmail`
 * - **Link an existing platform user to a user proxy** -> `linkUserProxy`
 * - **Add or update a user's scope entry** -> `updateUserAccess`
 * - **Remove one user scope entry** -> `removeUserAccess`
 *
 * ## Role Key Rule
 * Never submit semantic role IDs as `roleKeys`. Resolve them first:
 * 1. call `listRoles()`
 * 2. find the role where `role.id` matches the semantic ID
 * 3. submit `role.objKey` in `InviteOrLinkUserProxyByEmailRequest.roleKeys`, `LinkUserProxyRequest.roleKeys`, or `UpdateAccessRequest.roleKeys`
 *
 * ## Key Functions
 * | Function | Use For |
 * |----------|---------|
 * | `listRoles` | Read assignable roles for the current sandbox |
 * | `listBusinessPrivileges` | Read business privilege metadata |
 * | `listSandboxUsers` | Read users with access to the current sandbox |
 * | `getUserAccess` | Read one user's current scope entries and roles |
 * | `linkUserProxy` | Link an existing platform user to an existing user proxy |
 * | `listUserProxyAccessRoster` | Read shared proxy rows enriched with current-sandbox access status |
 * | `inviteOrLinkUserProxyByEmail` | Reuse/create a proxy, invite/link by email, and return refreshed access state |
 * | `setUserProxyRosterRoles` | Update roles for one roster row |
 * | `updateUserAccess` | Add or update one user scope entry |
 * | `removeUserAccess` | Remove one user scope entry |
 * | `hasBusinessPrivilege` | Server-check whether the current user has a privilege ID |
 * | `userPrivileges` | Server-read the current user's privilege IDs |
 * | `dataElementAccess` | Server-check current user's read/write/delete access to a data element ID |
 * | `hasDataElementAccess` | Server-check one read/write/delete access mode |
 * | `canReadDataElement` | Server-check read access to a data element ID |
 * | `canWriteDataElement` | Server-check write access to a data element ID |
 * | `canDeleteDataElement` | Server-check delete access to a data element ID |
 *
 * @example
 * // Resolve a semantic role ID to the persisted object key before assignment
 * const roles = await hx.listRoles();
 * const memberRole = roles.find((role) => role.id === 'householdMember');
 * if (!memberRole?.objKey) {
 *   throw new Error('Required role not found.');
 * }
 * await hx.updateUserAccess(userKey, {
 *   roleKeys: [memberRole.objKey],
 *   scopeKeyItems: [{ scopeKey: orgKey, dataElementId: 'family' }],
 * });
 *
 * @example
 * // Check the current user's business privilege
 * if (await hx.hasBusinessPrivilege('manageSharedLists')) {
 *   // Show controls for sharing list access
 * }
 *
 * @example
 * // Link an existing platform user to an existing unlinked user proxy record
 * await hx.linkUserProxy({
 *   userKey: 'usr~00~existing',
 *   userProxyElementId: 'familyMember',
 *   userProxyKey: existingFamilyMember.objKey,
 *   roleKeys: [memberRole.objKey],
 * });
 *
 * @example
 * // Check current user's data access before showing a CRUD control
 * if (await hx.canWriteDataElement('shoppingList')) {
 *   // Show controls that create or update shopping list records
 * }
 */

import axios from 'axios';
import { from, lastValueFrom, Observable } from 'rxjs';
import { getAuthToken, sandboxKey, serviceAddress } from './sdk-general';

/**
 * A data scope assigned to a user as part of a sandbox scope entry.
 */
export interface ScopeKeyItem {
    /** Object key for the scoped record, such as an organization or user proxy object key. */
    scopeKey: string;
    /** Data element ID for the scoped object. */
    dataElementId: string;
    /** Optional display label for the scope entry. */
    label?: string;
    /** Optional custom data scope identifier when assigning a custom scope. */
    customDataScopeId?: string;
}

/**
 * Role metadata available in the current sandbox.
 *
 * Use `id` to identify the intended role in code. Use `objKey` when assigning the role to a user through `roleKeys`.
 */
export interface Role {
    /** Persisted role object key. Required when assigning roles through `roleKeys`. */
    objKey?: string;
    /** Stable semantic role identifier. Do not submit this as a role key. */
    id: string;
    /** Human-readable role name. */
    name: string;
    /** Human-readable role description. */
    description?: string;
    /** Navigation object keys granted to this role. */
    navigationKeys?: string[];
    /** Data element object keys readable by this role. */
    readDataElementKeys?: string[];
    /** Data element object keys writable by this role. */
    writeDataElementKeys?: string[];
    /** Data element object keys deletable by this role. */
    deleteDataElementKeys?: string[];
    /** Platform system roles granted to this role. */
    systemRoles?: string[];
    /** Business privilege IDs granted to this role. */
    businessPrivilegeIds?: string[];
    /** Optional role grouping labels. */
    categories?: string[];
}

/**
 * Business privilege metadata available in the current sandbox.
 */
export interface BusinessPrivilege {
    /** Persisted privilege object key, when included by the API. */
    objKey?: string;
    /** Stable business privilege identifier used for checks and role grants. */
    id: string;
    /** Human-readable privilege name. */
    name: string;
    /** Human-readable privilege description. */
    description?: string;
    /** Optional privilege grouping labels. */
    categories?: string[];
}

/**
 * User summary for a user with access to the current sandbox.
 */
export interface SandboxUser {
    /** Persisted user object key. */
    userKey: string;
    /** Display name, when available. */
    name?: string;
    /** Email address, when available. */
    email?: string;
    /** Raw scope entries returned by the access service. */
    scopeElements?: unknown[];
}

/**
 * Full access wrapper for one user, including scope entries and role metadata when returned by the access service.
 */
export interface UserAccessWrapper {
    /** Raw user payload returned by the access service. */
    user: unknown;
    /** Raw scope entries for the user. */
    scopeElements: unknown[];
    /** Role metadata associated with the user's access, when returned. */
    roles?: Role[];
}

/**
 * Request body for linking an existing platform user to an existing unlinked user proxy record.
 */
export interface LinkUserProxyRequest {
    /** Persisted platform user object key to link. */
    userKey: string;
    /** User proxy data element ID for the proxy record being linked. */
    userProxyElementId: string;
    /** Existing unlinked user proxy object key to link to the platform user. */
    userProxyKey: string;
    /** Persisted role object keys (`Role.objKey`). Never pass semantic `Role.id` values here. */
    roleKeys: string[];
}

/**
 * One row in a user proxy access roster.
 *
 * `userProxy` is the shared identity/member record. `hasAccess` is current-sandbox access state and should be used
 * before rendering someone as active or authorized for the current solution.
 */
export interface UserProxyAccessRosterRow {
    /** Shared solution user proxy record. */
    userProxy: Record<string, unknown>;
    /** Linked platform user, when one exists and is visible to the access service. */
    user?: Record<string, unknown>;
    /** Pending invite token metadata, when a pending invite exists. */
    userToken?: Record<string, unknown>;
    /** Whether token lookup failed. */
    userTokenError?: boolean;
    /** Token validation error code, when available. */
    userTokenErrorCode?: string;
    /** User proxy login status such as `Pending`, `Active`, or empty. */
    loginStatus?: string;
    /** Whether the linked user has current-sandbox scope access for this roster context. */
    hasAccess: boolean;
    /** Matching current-sandbox scope element for this proxy/org context. */
    matchingScopeElement?: Record<string, unknown>;
    /** Persisted role object keys assigned on the matching scope element. */
    roleKeys?: string[];
    /** Role metadata for `roleKeys`, when available. */
    roles?: Role[];
}

/**
 * Request body for access-service managed user proxy invite/link flow.
 */
export interface InviteOrLinkUserProxyByEmailRequest {
    /** Email address to normalize and invite/link. */
    email: string;
    /** Optional first name to use when the server must create a new proxy. */
    firstName?: string;
    /** Optional last name to use when the server must create a new proxy. */
    lastName?: string;
    /** Whether the created/reused proxy should be marked as an org proxy admin identity. */
    orgProxyAdmin?: boolean;
    /** Persisted role object keys (`Role.objKey`). Never pass semantic `Role.id` values here. */
    roleKeys: string[];
    /** Optional notification template identifier. */
    notificationTemplate?: string;
}

/**
 * Action performed by `inviteOrLinkUserProxyByEmail`.
 */
export type InviteOrLinkUserProxyAction =
    | 'createdProxyAndInvited'
    | 'reusedProxyAndInvited'
    | 'resentInvite'
    | 'linkedExistingUser'
    | 'alreadyLinked';

/**
 * Result returned from access-service managed invite/link flow.
 *
 * `rolesUpdated` is only meaningful for `alreadyLinked` and `linkedExistingUser`. It is false for invite actions
 * because invite role keys are carried by the pending invite/access configuration.
 */
export interface InviteOrLinkUserProxyResult {
    /** Server action that was performed. */
    action: InviteOrLinkUserProxyAction;
    /** Whether requested role keys were added or updated on existing current-sandbox access. */
    rolesUpdated?: boolean;
    /** Refreshed roster row after the operation. */
    row: UserProxyAccessRosterRow;
}

/**
 * Request body for setting roles on one roster row.
 */
export interface SetUserProxyRosterRolesRequest {
    /** Persisted role object keys (`Role.objKey`). Never pass semantic `Role.id` values here. */
    roleKeys: string[];
}

/**
 * Request body for adding or updating one user scope entry.
 */
export interface UpdateAccessRequest {
    /** Existing scope element ID. When omitted, a new scope entry is added. */
    scopeElementId?: string;
    /** Persisted role object keys (`Role.objKey`). Never pass semantic `Role.id` values here. */
    roleKeys: string[];
    /** Data scopes to store on the scope entry. */
    scopeKeyItems: ScopeKeyItem[];
    /** Whether this scope entry should apply globally instead of being limited to the provided scopes. */
    globalAccess?: boolean;
}

/**
 * Server response for current-user business privilege checks.
 */
export interface BusinessPrivilegeCheckResult {
    /** Checked business privilege ID. */
    businessPrivilegeId: string;
    /** Whether the authenticated user has the privilege in the current sandbox. */
    hasPrivilege: boolean;
}

/**
 * Server response for current-user business privilege lists.
 */
export interface CurrentBusinessPrivilegesResult {
    /** Business privilege IDs granted to the authenticated user in the current sandbox. */
    businessPrivileges: string[];
}

type CurrentBusinessPrivilegesResponse = CurrentBusinessPrivilegesResult | string[];

/**
 * Data element access mode for current-user R/W/D privilege checks.
 */
export type DataElementAccessMode = 'read' | 'write' | 'delete';

/**
 * Server response for current-user data element access checks.
 */
export interface DataElementAccessResult {
    /** Stable data element ID requested by the caller. */
    dataElementId: string;
    /** Persisted data element object key resolved by the server. */
    dataElementKey: string;
    /** Whether the authenticated user can read records for this data element. */
    canRead: boolean;
    /** Whether the authenticated user can create or update records for this data element. */
    canWrite: boolean;
    /** Whether the authenticated user can delete records for this data element. */
    canDelete: boolean;
}

async function authHeaders() {
    if (!getAuthToken) {
        throw new Error('SDK not initialized.');
    }

    const authToken = await lastValueFrom(getAuthToken());
    return { Authorization: `Bearer ${authToken}` };
}

/**
 * Lists roles available in the current sandbox.
 *
 * Use this before assigning roles so semantic role IDs can be resolved to persisted `objKey` values. Assignment
 * requests must send `Role.objKey` values in `roleKeys`.
 *
 * @returns Promise resolving to role metadata for the current sandbox
 */
export async function listRoles(): Promise<Role[]> {
    const response = await axios.get(`${serviceAddress}/access/sandboxes/${sandboxKey}/allRoles`, {
        headers: await authHeaders(),
    });
    return response.data;
}

/**
 * Observable version of `listRoles`. See `listRoles` for details.
 */
export function listRolesAsObservable(): Observable<Role[]> {
    return from(listRoles());
}

/**
 * Lists business privileges available in the current sandbox.
 *
 * Business privilege IDs are used by `hasBusinessPrivilege`, current-user privilege checks, and role
 * `businessPrivilegeIds`.
 *
 * @returns Promise resolving to business privilege metadata
 */
export async function listBusinessPrivileges(): Promise<BusinessPrivilege[]> {
    const response = await axios.get(`${serviceAddress}/access/sandboxes/${sandboxKey}/businessPrivileges`, {
        headers: await authHeaders(),
    });
    return response.data;
}

/**
 * Observable version of `listBusinessPrivileges`. See `listBusinessPrivileges` for details.
 */
export function listBusinessPrivilegesAsObservable(): Observable<BusinessPrivilege[]> {
    return from(listBusinessPrivileges());
}

/**
 * Lists users with access to the current sandbox.
 *
 * Use `getUserAccess` when full scope-entry details are needed for a specific user.
 *
 * @returns Promise resolving to sandbox user summaries
 */
export async function listSandboxUsers(): Promise<SandboxUser[]> {
    const response = await axios.get(`${serviceAddress}/access/sandboxes/${sandboxKey}/users`, {
        headers: await authHeaders(),
    });
    return response.data;
}

/**
 * Observable version of `listSandboxUsers`. See `listSandboxUsers` for details.
 */
export function listSandboxUsersAsObservable(): Observable<SandboxUser[]> {
    return from(listSandboxUsers());
}

/**
 * Gets one user's current sandbox access, including scope entries and any role metadata returned by the access service.
 *
 * @param userKey - Persisted user object key
 * @returns Promise resolving to the user's access wrapper
 */
export async function getUserAccess(userKey: string): Promise<UserAccessWrapper> {
    const response = await axios.get(`${serviceAddress}/access/sandboxes/${sandboxKey}/user/${userKey}/access`, {
        headers: await authHeaders(),
    });
    return response.data;
}

/**
 * Observable version of `getUserAccess`. See `getUserAccess` for details.
 */
export function getUserAccessAsObservable(userKey: string): Observable<UserAccessWrapper> {
    return from(getUserAccess(userKey));
}

/**
 * Links an existing platform user to an existing unlinked user proxy record and assigns role keys for that scope.
 *
 * Use this when the user already exists and you have selected or created the user proxy record that should represent
 * them in the solution. `req.userKey` is the platform user object key. `req.userProxyKey` is the solution user proxy
 * object key. `req.roleKeys` must contain persisted role object keys from `Role.objKey`, not semantic role IDs.
 *
 * @param req - Existing-user link request
 */
export async function linkUserProxy(req: LinkUserProxyRequest): Promise<void> {
    const roleKeys = req.roleKeys.map((roleKey) => encodeURIComponent(roleKey)).join(',');
    await axios.post(
        `${serviceAddress}/access/sandboxes/${sandboxKey}/userProxy/${encodeURIComponent(req.userProxyKey)}/${encodeURIComponent(req.userProxyElementId)}/linkProxy?userKey=${encodeURIComponent(req.userKey)}&roleKeys=${roleKeys}`,
        null,
        {
            headers: await authHeaders(),
        },
    );
}

/**
 * Observable version of `linkUserProxy`. See `linkUserProxy` for details.
 */
export function linkUserProxyAsObservable(req: LinkUserProxyRequest): Observable<void> {
    return from(linkUserProxy(req));
}

/**
 * Lists shared user proxy records enriched with current-sandbox access state.
 *
 * Use this for generated user-access pages. A returned proxy/member record is identity data; `row.hasAccess` and
 * `row.matchingScopeElement` describe whether that identity has access in the current sandbox for the requested
 * org/user-proxy context.
 *
 * @param orgProxyKey - Organization proxy object key for the roster context
 * @param orgProxyElementId - Organization proxy data element ID
 * @param userProxyElementId - User proxy/member data element ID
 */
export async function listUserProxyAccessRoster(
    orgProxyKey: string,
    orgProxyElementId: string,
    userProxyElementId: string,
): Promise<UserProxyAccessRosterRow[]> {
    const response = await axios.get(
        `${serviceAddress}/access/sandboxes/${sandboxKey}/userProxyRoster/${encodeURIComponent(orgProxyKey)}/${encodeURIComponent(orgProxyElementId)}/${encodeURIComponent(userProxyElementId)}`,
        {
            headers: await authHeaders(),
        },
    );
    return response.data;
}

/**
 * Observable version of `listUserProxyAccessRoster`. See `listUserProxyAccessRoster` for details.
 */
export function listUserProxyAccessRosterAsObservable(
    orgProxyKey: string,
    orgProxyElementId: string,
    userProxyElementId: string,
): Observable<UserProxyAccessRosterRow[]> {
    return from(listUserProxyAccessRoster(orgProxyKey, orgProxyElementId, userProxyElementId));
}

/**
 * Invites or links a user by email through the access service roster helper.
 *
 * The server normalizes email, reuses an existing shared proxy for the same org/user-proxy context when present,
 * creates a proxy only when absent, links active users, refreshes pending invites, and returns the refreshed roster row.
 *
 * @param orgProxyKey - Organization proxy object key for the roster context
 * @param orgProxyElementId - Organization proxy data element ID
 * @param userProxyElementId - User proxy/member data element ID
 * @param req - Invite/link request
 */
export async function inviteOrLinkUserProxyByEmail(
    orgProxyKey: string,
    orgProxyElementId: string,
    userProxyElementId: string,
    req: InviteOrLinkUserProxyByEmailRequest,
): Promise<InviteOrLinkUserProxyResult> {
    const response = await axios.post(
        `${serviceAddress}/access/sandboxes/${sandboxKey}/userProxyRoster/${encodeURIComponent(orgProxyKey)}/${encodeURIComponent(orgProxyElementId)}/${encodeURIComponent(userProxyElementId)}/inviteOrLink`,
        req,
        {
            headers: await authHeaders(),
        },
    );
    return response.data;
}

/**
 * Observable version of `inviteOrLinkUserProxyByEmail`. See `inviteOrLinkUserProxyByEmail` for details.
 */
export function inviteOrLinkUserProxyByEmailAsObservable(
    orgProxyKey: string,
    orgProxyElementId: string,
    userProxyElementId: string,
    req: InviteOrLinkUserProxyByEmailRequest,
): Observable<InviteOrLinkUserProxyResult> {
    return from(inviteOrLinkUserProxyByEmail(orgProxyKey, orgProxyElementId, userProxyElementId, req));
}

/**
 * Updates role keys for one roster row and returns the refreshed row.
 *
 * `roleKeys` must contain persisted role object keys from `Role.objKey`, not semantic role IDs.
 *
 * @param orgProxyKey - Organization proxy object key for the roster context
 * @param orgProxyElementId - Organization proxy data element ID
 * @param userProxyElementId - User proxy/member data element ID
 * @param proxyKey - User proxy object key for the row being updated
 * @param req - Role update request
 */
export async function setUserProxyRosterRoles(
    orgProxyKey: string,
    orgProxyElementId: string,
    userProxyElementId: string,
    proxyKey: string,
    req: SetUserProxyRosterRolesRequest,
): Promise<UserProxyAccessRosterRow> {
    const response = await axios.post(
        `${serviceAddress}/access/sandboxes/${sandboxKey}/userProxyRoster/${encodeURIComponent(orgProxyKey)}/${encodeURIComponent(orgProxyElementId)}/${encodeURIComponent(userProxyElementId)}/proxy/${encodeURIComponent(proxyKey)}/roles`,
        req,
        {
            headers: await authHeaders(),
        },
    );
    return response.data;
}

/**
 * Observable version of `setUserProxyRosterRoles`. See `setUserProxyRosterRoles` for details.
 */
export function setUserProxyRosterRolesAsObservable(
    orgProxyKey: string,
    orgProxyElementId: string,
    userProxyElementId: string,
    proxyKey: string,
    req: SetUserProxyRosterRolesRequest,
): Observable<UserProxyAccessRosterRow> {
    return from(setUserProxyRosterRoles(orgProxyKey, orgProxyElementId, userProxyElementId, proxyKey, req));
}

/**
 * Adds or updates one user's sandbox scope entry.
 *
 * If `req.scopeElementId` is present, the existing scope entry is updated. If it is omitted, a new scope entry is
 * added. `req.roleKeys` must contain persisted role object keys from `Role.objKey`, not semantic role IDs.
 *
 * @param userKey - Persisted user object key
 * @param req - Scope-entry access update request
 */
export async function updateUserAccess(userKey: string, req: UpdateAccessRequest): Promise<void> {
    const path = req.scopeElementId ? 'updateScopeElement' : 'addScopeElement';
    await axios.post(`${serviceAddress}/access/sandboxes/${sandboxKey}/user/${userKey}/${path}`, req, {
        headers: await authHeaders(),
    });
}

/**
 * Observable version of `updateUserAccess`. See `updateUserAccess` for details.
 */
export function updateUserAccessAsObservable(userKey: string, req: UpdateAccessRequest): Observable<void> {
    return from(updateUserAccess(userKey, req));
}

/**
 * Removes one sandbox scope entry from a user.
 *
 * @param userKey - Persisted user object key
 * @param scopeElementId - Scope element ID to remove from the user
 */
export async function removeUserAccess(userKey: string, scopeElementId: string): Promise<void> {
    await axios.delete(`${serviceAddress}/access/sandboxes/${sandboxKey}/user/${userKey}/removeScopeElements`, {
        headers: await authHeaders(),
        data: { scopeElementIds: [scopeElementId] },
    });
}

/**
 * Observable version of `removeUserAccess`. See `removeUserAccess` for details.
 */
export function removeUserAccessAsObservable(userKey: string, scopeElementId: string): Observable<void> {
    return from(removeUserAccess(userKey, scopeElementId));
}

/**
 * Checks whether the authenticated user has a business privilege ID by calling the access service.
 *
 * This intentionally does not read browser-local context, because local state can be manipulated.
 * Treat this as an authorization check and await the server response.
 *
 * @param privilegeId - Stable business privilege ID
 * @returns Promise resolving to true when the current user has the privilege
 */
export async function hasBusinessPrivilege(privilegeId: string): Promise<boolean> {
    const response = await axios.get<BusinessPrivilegeCheckResult>(
        `${serviceAddress}/access/sandboxes/${sandboxKey}/businessPrivileges/${encodeURIComponent(privilegeId)}/currentUserHasPrivilege`,
        {
            headers: await authHeaders(),
        },
    );
    return response.data.hasPrivilege;
}

/**
 * Observable version of `hasBusinessPrivilege`. See `hasBusinessPrivilege` for details.
 */
export function hasBusinessPrivilegeAsObservable(privilegeId: string): Observable<boolean> {
    return from(hasBusinessPrivilege(privilegeId));
}

/**
 * Returns the authenticated user's business privilege IDs by calling the access service.
 *
 * This intentionally does not read browser-local context, because local state can be manipulated.
 *
 * @returns Promise resolving to business privilege IDs for the current user
 */
export async function userPrivileges(): Promise<string[]> {
    const response = await axios.get<CurrentBusinessPrivilegesResponse>(
        `${serviceAddress}/access/sandboxes/${sandboxKey}/currentBusinessPrivileges`,
        {
            headers: await authHeaders(),
        },
    );
    if (Array.isArray(response.data)) {
        return response.data;
    }
    return response.data.businessPrivileges ?? [];
}

/**
 * Observable version of `userPrivileges`. See `userPrivileges` for details.
 */
export function userPrivilegesAsObservable(): Observable<string[]> {
    return from(userPrivileges());
}

/**
 * Checks the authenticated user's data element read/write/delete access through the access service.
 *
 * The caller passes the stable data element ID. The server resolves that ID to the persisted data element key before
 * checking the user's token, so generated code does not need to manage ID-to-key mappings.
 *
 * @param dataElementId - Stable data element ID
 * @returns Promise resolving to the current user's data element access flags
 */
export async function dataElementAccess(dataElementId: string): Promise<DataElementAccessResult> {
    const response = await axios.get<DataElementAccessResult>(
        `${serviceAddress}/access/sandboxes/${sandboxKey}/dataElements/${encodeURIComponent(dataElementId)}/currentUserAccess`,
        {
            headers: await authHeaders(),
        },
    );
    return response.data;
}

/**
 * Observable version of `dataElementAccess`. See `dataElementAccess` for details.
 */
export function dataElementAccessAsObservable(dataElementId: string): Observable<DataElementAccessResult> {
    return from(dataElementAccess(dataElementId));
}

/**
 * Checks one data element access mode for the authenticated user through the access service.
 *
 * @param dataElementId - Stable data element ID
 * @param access - Access mode to check: `read`, `write`, or `delete`
 * @returns Promise resolving to true when the current user has the requested data access
 */
export async function hasDataElementAccess(dataElementId: string, access: DataElementAccessMode): Promise<boolean> {
    const result = await dataElementAccess(dataElementId);
    switch (access) {
        case 'read':
            return result.canRead;
        case 'write':
            return result.canWrite;
        case 'delete':
            return result.canDelete;
        default:
            return false;
    }
}

/**
 * Observable version of `hasDataElementAccess`. See `hasDataElementAccess` for details.
 */
export function hasDataElementAccessAsObservable(
    dataElementId: string,
    access: DataElementAccessMode,
): Observable<boolean> {
    return from(hasDataElementAccess(dataElementId, access));
}

/**
 * Checks whether the authenticated user can read records for a data element ID.
 */
export function canReadDataElement(dataElementId: string): Promise<boolean> {
    return hasDataElementAccess(dataElementId, 'read');
}

/**
 * Observable version of `canReadDataElement`. See `canReadDataElement` for details.
 */
export function canReadDataElementAsObservable(dataElementId: string): Observable<boolean> {
    return from(canReadDataElement(dataElementId));
}

/**
 * Checks whether the authenticated user can create or update records for a data element ID.
 */
export function canWriteDataElement(dataElementId: string): Promise<boolean> {
    return hasDataElementAccess(dataElementId, 'write');
}

/**
 * Observable version of `canWriteDataElement`. See `canWriteDataElement` for details.
 */
export function canWriteDataElementAsObservable(dataElementId: string): Observable<boolean> {
    return from(canWriteDataElement(dataElementId));
}

/**
 * Checks whether the authenticated user can delete records for a data element ID.
 */
export function canDeleteDataElement(dataElementId: string): Promise<boolean> {
    return hasDataElementAccess(dataElementId, 'delete');
}

/**
 * Observable version of `canDeleteDataElement`. See `canDeleteDataElement` for details.
 */
export function canDeleteDataElementAsObservable(dataElementId: string): Observable<boolean> {
    return from(canDeleteDataElement(dataElementId));
}

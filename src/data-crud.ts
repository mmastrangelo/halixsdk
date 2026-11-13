// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/data-crud
 * @description Data CRUD operations for the Halix Platform action SDK. This module provides functions
 * for creating, reading, updating, and deleting data objects through the Halix data service API.
 * 
 * Key features:
 * - Retrieve one object a time
 * - Retrieve all objects related to a parent object
 * - Save a single object
 * - Delete a single or multiple objects
 *
 * @usage
 * ## When to Use
 * - **Filtered accessible-record reads without list behavior** → `getAccessibleObjects`
 * - **Naturally small reference/dimension sets** → unfiltered `getAccessibleObjects`
 * - **Read specific accessible objects by key list** → `getObjects`
 * - **Get single object by key** → `getObject`
 * - **Fetch a known parent's child records** → `getRelatedObjects`
 * - **Create/update single object** → `saveObject`
 * - **Change a record from its current values when others may change it too** → `updateObject`
 * - **Delete single object** → `deleteObject`
 *
 * ## Save or Update
 * - `saveObject` writes the record you hold. If someone else saved the record after you read it,
 *   your save replaces theirs: the last writer wins. Use it to create records and for edits where
 *   that is acceptable.
 * - `updateObject` is for a change that depends on the record's current values, such as taking the
 *   next number from a counter or adding to a balance, when two callers may make it at the same
 *   time. It reads the record, runs your function on it and saves only if the record has not
 *   changed since that read. If it has, it reads again and runs your function again.
 * - The function you pass may run more than once. It must work only from the record it is given
 *   and do nothing else: no other saves, no outside calls, and no values kept from an earlier run.
 * - Throw from the function to stop without saving, for example when a limit is reached.
 * - `updateObject` throws `UpdateConflictError` when the record kept changing and nothing was
 *   saved, and `UpdateOutcomeUnknownError` when the save got no answer and may have been written.
 *
 * ## Record Retrieval Decision
 * - Use `getAggregateData` from the data-aggregate module for counts, sums, rankings, and grouped metrics.
 * - Use filtered `getAccessibleObjects` for bounded record reads that do not need list pagination,
 *   totals, sort, or projection.
 * - Use unfiltered `getAccessibleObjects` only for naturally small reference/dimension sets.
 * - Use `getRelatedObjects` when the component already has a concrete parent key and is fetching
 *   that parent's children.
 * - Use `getListData` from the lists module for paged list UIs and list-management workflows.
 *
 * ## When NOT to Use
 * - **High-cardinality report reads without a narrowing filter**
 * - **Paged list UI pagination, explicit totals, server sort, or list field projection** → use lists skill with `getListData`
 * - **Bulk updates** → use lists skill with `massEdit`
 * - **Aggregations** → use data-aggregate skill
 *
 * ## Key Functions
 * | Function | Use For |
 * |----------|---------|
 * | `getAccessibleObjects` | Filtered accessible reads; unfiltered only for small reference/dimension sets |
 * | `getObjects` | Read accessible objects from a specific key list |
 * | `getObject` | Single object by key |
 * | `getRelatedObjects` | Children of a known parent record |
 * | `saveObject` | Create or update one object |
 * | `saveRelatedObject` | Create or update one object and establish relationship to a parent |
 * | `updateObject` | Change one existing object from its current values, safely against other writers |
 * | `deleteObject` | Delete one object without parent scope |
 * | `deleteRelatedObject` | Delete one related object |
 *
 * @example
 * // Get accessible class enrollments for a bounded date window
 * // Create the filter expression with build_filter_expression before coding it here.
 * const recentEnrollments = await hx.getAccessibleObjects(
 *   'classEnrollment',
 *   "startDate>=date:'2025-01-01'"
 * );
 *
 * @example
 * // Get accessible recipes from a known key list
 * const recipes = await hx.getObjects('recipe', recipeKeys);
 *
 * @example
 * // Unfiltered accessible reads are for naturally small reference/dimension sets
 * const categories = await hx.getAccessibleObjects('category');
 *
 * @example
 * // Get single recipe
 * const recipe = await hx.getObject('recipe', recipeKey);
 *
 * @example
 * // Get ingredients for a known recipe
 * const ingredients = await hx.getRelatedObjects(
 *   'recipe', recipeKey, 'ingredient'
 * );
 *
 * @example
 * // Save a recipe
 * await hx.saveObject(
 *   'recipe',
 *   { name: 'Soup' }
 * );
 *
 * @example
 * // Save new ingredient related to a recipe
 * await hx.saveRelatedObject(
 *   'recipe', recipeKey, 'ingredient',
 *   { name: 'Salt', amount: '1 tsp' }
 * );
 *
 * @example
 * // Take the next three numbers from a counter kept on a record
 * const saved = await hx.updateObject('raffle', raffleKey, (raffle) => {
 *   if (raffle.nextTicketNumber + 3 > raffle.lastTicketNumber + 1) {
 *     throw new Error('Sold out');
 *   }
 *   raffle.nextTicketNumber += 3;
 *   return raffle;
 * });
 * const firstNumber = saved.nextTicketNumber - 3;
 *
 * @example
 * // Delete a recipe
 * await hx.deleteObject('recipe', recipeKey);
 */

import axios from 'axios';
import { from, Observable, lastValueFrom } from 'rxjs';
import { sandboxKey, serviceAddress, getAuthToken, userContext, buildApplyContextParamValue } from './sdk-general.js';
import type { FilterExpression } from './filter-expression.js';

// ================================================================================
// INTERFACES
// ================================================================================

/**
 * SaveOptions is an interface for specifying save operation options.
 */
export interface SaveOptions {
    /** Whether to bypass validation */
    bypassValidation?: boolean;
    /** Optional relationships to include as nested objects in the saved response */
    fetchedRelationships?: string[];
}

type SaveBody = string | object;

/**
 * UpdateOptions is an interface for specifying updateObject options.
 */
export interface UpdateOptions extends SaveOptions {
    /** How many times the read, change and save may run before giving up. Default 5. */
    maxAttempts?: number;
    /** Time allowed for the whole call in milliseconds, waits included. Default 10000. */
    timeoutMs?: number;
}

/**
 * UpdateConflictError is thrown by updateObject when the record changed on every attempt, or the
 * time allowed ran out. This call saved nothing.
 */
export class UpdateConflictError extends Error {
    /** How many times the read, change and save were tried. */
    readonly attempts: number;

    constructor(message: string, attempts: number) {
        super(message);
        this.name = 'UpdateConflictError';
        this.attempts = attempts;
    }
}

/**
 * UpdateOutcomeUnknownError is thrown by updateObject when the save got no answer, for example
 * because the connection dropped. The record may or may not have been saved, so the update is not
 * tried again.
 */
export class UpdateOutcomeUnknownError extends Error {
    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = 'UpdateOutcomeUnknownError';
        if (cause !== undefined) {
            Object.defineProperty(this, 'cause', {
                configurable: true,
                value: cause,
            });
        }
    }
}

const RECORD_VERSION_HEADER = 'X-Halix-Record-Version';
const RECORD_CHANGED_ERROR_CODE = 'ModifiedSinceLastOpenedError';
const DEFAULT_UPDATE_ATTEMPTS = 5;
const DEFAULT_UPDATE_TIMEOUT_MS = 10000;
const UPDATE_RETRY_STEP_MS = 50;

// ================================================================================
// DATA RETRIEVAL FUNCTIONS
// ================================================================================

/**
 * Retrieves a single object by dataElementId and key. Optionally fetch related objects.
 * 
 * @returns Promise<any> - the object data
 */
export async function getObject(dataElementId: string, key: string, fetchedRelationships?: string[]) {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    let params;
    if (fetchedRelationships) {
        let p = {};
        if (fetchedRelationships) {
            (<any>p).fetchedRelationships = fetchedRelationships.join(",");
        }

        params = new URLSearchParams(p);
    }

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${dataElementId}/${key}`;

    let authToken = await lastValueFrom(getAuthToken());

    let response = await axios.get(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
        params: params,
    });

    return response.data;
}

/**
 * Observable version of getObject. See getObject for details.
 */
export function getObjectAsObservable(dataElementId: string, key: string, fetchedRelationships?: string[]): Observable<any> {
    return from(getObject(dataElementId, key, fetchedRelationships));
}

/**
 * Retrieves all objects related to a parent through a schema relationship. Commonly used to get objects belonging to current user/org proxy.
 * 
 * @param parentElementId - Parent element ID
 * @param parentKey - Parent object key; important: this establishes the scope of the query; use an appropriate scope key
 * @param elementId - Child element ID
 * @param filter - Optional Halix filter expression. This is not SQL or JavaScript syntax. Call `build_filter_expression` to generate it. Must be less than 200 characters.
 * @param fetchedRelationships - Optional relationships to include as nested objects
 * @returns Promise<any[]>
 */
export async function getRelatedObjects(parentElementId: string, parentKey: string, elementId: string, filter?: FilterExpression, fetchedRelationships?: string[]): Promise<any[]> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    let params;
    if (filter || fetchedRelationships) {
        let p = {};
        if (filter) {
            (<any>p).filter = filter;
        }
        if (fetchedRelationships) {
            (<any>p).fetchedRelationships = fetchedRelationships.join(",");
        }

        params = new URLSearchParams(p);
    }

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${parentElementId}/${parentKey}/${elementId}`;

    let authToken = await lastValueFrom(getAuthToken());

    let response = await axios.get(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
        params: params,
    });

    return response.data;
}

/**
 * Observable version of getRelatedObjects. See getRelatedObjects for details.
 */
export function getRelatedObjectsAsObservable(parentElementId: string, parentKey: string, elementId: string, filter?: FilterExpression, fetchedRelationships?: string[]): Observable<any[]> {
    return from(getRelatedObjects(parentElementId, parentKey, elementId, filter, fetchedRelationships));
}

/**
 * Retrieves all objects for a data element that the current user has access to.
 *
 * @param dataElementId - Data element ID
 * @param filter - Optional Halix filter expression. This is not SQL or JavaScript syntax. Call `build_filter_expression` to generate it. Must be less than 200 characters.
 * @param fetchedRelationships - Optional relationships to include as nested objects
 * @param applyContext - Optional flag to apply navigation context scoping. When true, navigation context is read from UserContext.navigationContext and results are limited by the navigation context org proxy.
 * @returns Promise<any[]>
 */
export async function getAccessibleObjects(dataElementId: string, filter?: FilterExpression, fetchedRelationships?: string[], applyContext?: boolean): Promise<any[]> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    let params = buildAccessibleObjectsParams(filter, fetchedRelationships, applyContext);

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${dataElementId}`;

    let authToken = await lastValueFrom(getAuthToken());

    let response = await axios.get(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
        params: params,
    });

    return response.data;
}

/**
 * Observable version of getAccessibleObjects. See getAccessibleObjects for details.
 */
export function getAccessibleObjectsAsObservable(dataElementId: string, filter?: FilterExpression, fetchedRelationships?: string[], applyContext?: boolean): Observable<any[]> {
    return from(getAccessibleObjects(dataElementId, filter, fetchedRelationships, applyContext));
}

/**
 * Retrieves accessible objects for a data element from a specific key list.
 * Only objects that are accessible to the current user are returned. If applyContext is true, keyed objects outside the current navigation context are also omitted.
 *
 * @param dataElementId - Data element ID
 * @param keys - Object keys to retrieve
 * @param filter - Optional Halix filter expression. This is not SQL or JavaScript syntax. Call `build_filter_expression` to generate it. Must be less than 200 characters.
 * @param fetchedRelationships - Optional relationships to include as nested objects
 * @param applyContext - Optional flag to apply navigation context scoping. When true, navigation context is read from UserContext.navigationContext and results are limited by the navigation context org proxy.
 * @returns Promise<any[]>
 */
export async function getObjects(dataElementId: string, keys: string[], filter?: FilterExpression, fetchedRelationships?: string[], applyContext?: boolean): Promise<any[]> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    let params = buildAccessibleObjectsParams(filter, fetchedRelationships, applyContext, keys);

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${dataElementId}`;

    let authToken = await lastValueFrom(getAuthToken());

    let response = await axios.get(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
        params: params,
    });

    return response.data;
}

/**
 * Observable version of getObjects. See getObjects for details.
 */
export function getObjectsAsObservable(dataElementId: string, keys: string[], filter?: FilterExpression, fetchedRelationships?: string[], applyContext?: boolean): Observable<any[]> {
    return from(getObjects(dataElementId, keys, filter, fetchedRelationships, applyContext));
}

// ================================================================================
// DATA SAVE FUNCTIONS
// ================================================================================

/**
 * Saves an object without establishing a parent relationship. Returns saved object with any server-assigned values (objKey, calculated fields).
 *
 * @param dataElementId - Data element ID for the object being saved
 * @param objectToSave - Object data or JSON string of object data
 * @param opts - Optional save options (e.g., bypassValidation, fetchedRelationships)
 * @returns Promise<any> - saved object with updates including server-assigned values (objKey, calculated fields)
 */
export async function saveObject(dataElementId: string, objectToSave: SaveBody, opts?: SaveOptions): Promise<any> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    const queryString = buildSaveQueryString(opts, true);
    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${dataElementId}?${queryString}`;

    let authToken = await lastValueFrom(getAuthToken());

    let response = await axios.post(url, objectToSave, {
        headers: { "Authorization": `Bearer ${authToken}` },
    });

    return response.data;
}

/**
 * Observable version of saveObject. See saveObject for details.
 */
export function saveObjectAsObservable(dataElementId: string, objectToSave: SaveBody, opts?: SaveOptions): Observable<any> {
    return from(saveObject(dataElementId, objectToSave, opts));
}

/**
 * Saves a related object and establishes or updates its relationship to a parent. Returns saved object with any server-assigned values (objKey, calculated fields).
 * 
 * @param parentElementId - Parent element ID
 * @param parentKey - Parent object key; important: this establishes the scope of the save operation; use an appropriate scope Key
 * @param elementId - Child element ID for the object being saved
 * @param objectToSave - Object data or JSON string of object data
 * @param opts - Optional save options (e.g., bypassValidation, fetchedRelationships)
 * @returns Promise<any> - saved object with updates including server-assigned values (objKey, calculated fields)
 */
export async function saveRelatedObject(parentElementId: string, parentKey: string, elementId: string, objectToSave: SaveBody, opts?: SaveOptions): Promise<any> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    const queryString = buildSaveQueryString(opts);
    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${parentElementId}/${parentKey}/${elementId}?${queryString}`;

    let authToken = await lastValueFrom(getAuthToken());

    let response = await axios.post(url, objectToSave, {
        headers: { "Authorization": `Bearer ${authToken}` },
    });

    return response.data;
}

/**
 * Observable version of saveRelatedObject. See saveRelatedObject for details.
 */
export function saveRelatedObjectAsObservable(parentElementId: string, parentKey: string, elementId: string, objectToSave: SaveBody, opts?: SaveOptions): Observable<any> {
    return from(saveRelatedObject(parentElementId, parentKey, elementId, objectToSave, opts));
}

// ================================================================================
// DATA UPDATE FUNCTIONS
// ================================================================================

/**
 * Changes an existing object from its current values, safely against other writers. It reads the
 * object, passes it to `change`, and saves the result only if the object has not changed since
 * that read. If it has, it reads again and runs `change` again.
 *
 * Use it instead of saveObject when the new values depend on the stored ones and two callers may
 * make the change at the same time, such as taking the next number from a counter. saveObject
 * writes what the caller holds, and the last writer wins.
 *
 * `change` may run more than once. It must work only from the object it is given and do nothing
 * else: no other saves, no outside calls, and no values kept from an earlier run. It may change the
 * object in place or return a new one. If it throws, the update stops and nothing is saved.
 *
 * @param dataElementId - Data element ID of the object
 * @param key - Key of the existing object
 * @param change - Function that applies the change to the object's current values
 * @param opts - Optional settings: maxAttempts (default 5), timeoutMs for the whole call
 * (default 10000), and the saveObject options
 * @returns Promise<T> - the saved object
 * @throws UpdateConflictError when the object changed on every attempt or the time ran out; nothing was saved
 * @throws UpdateOutcomeUnknownError when the save got no answer and may have been written
 */
export async function updateObject<T = any>(dataElementId: string, key: string, change: (current: T) => T | void | Promise<T | void>, opts?: UpdateOptions): Promise<T> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    const maxAttempts = opts?.maxAttempts ?? DEFAULT_UPDATE_ATTEMPTS;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
        throw new Error('maxAttempts must be a whole number of 1 or more.');
    }
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_UPDATE_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error('timeoutMs must be greater than 0.');
    }

    const deadline = Date.now() + timeoutMs;
    const readUrl = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${dataElementId}/${key}`;
    const saveUrl = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${dataElementId}?${buildSaveQueryString(opts, true)}`;

    let attempts = 0;
    while (attempts < maxAttempts) {
        let remaining = deadline - Date.now();
        if (remaining <= 0) {
            break;
        }
        attempts++;

        const authToken = await lastValueFrom(getAuthToken());
        const read = await axios.get(readUrl, {
            headers: { "Authorization": `Bearer ${authToken}` },
            timeout: remaining,
        });

        const version = readRecordVersion(read.headers);
        if (!version) {
            throw new Error('The service returned no record version, so updateObject cannot protect this change.');
        }

        const current = read.data as T;
        const changed = (await change(current)) ?? current;

        remaining = deadline - Date.now();
        if (remaining <= 0) {
            break;
        }

        try {
            const saved = await axios.post(saveUrl, { ...(changed as object), objKey: key }, {
                headers: {
                    "Authorization": `Bearer ${authToken}`,
                    [RECORD_VERSION_HEADER]: version,
                },
                timeout: remaining,
            });
            return saved.data as T;
        } catch (err) {
            if (!hasResponse(err)) {
                throw new UpdateOutcomeUnknownError('The save got no answer. The object may or may not have been saved.', err);
            }
            if (!isRecordChangedError(err)) {
                throw err;
            }
        }

        // Another writer saved first. Wait a short random time so two callers that collided
        // do not collide again in step.
        const wait = Math.min(Math.random() * UPDATE_RETRY_STEP_MS * attempts, deadline - Date.now());
        if (attempts < maxAttempts && wait > 0) {
            await new Promise(resolve => setTimeout(resolve, wait));
        }
    }

    throw new UpdateConflictError(`The object was changed by another writer on each of ${attempts} attempts, or the time allowed ran out. Nothing was saved.`, attempts);
}

/**
 * Observable version of updateObject. See updateObject for details.
 */
export function updateObjectAsObservable<T = any>(dataElementId: string, key: string, change: (current: T) => T | void | Promise<T | void>, opts?: UpdateOptions): Observable<T> {
    return from(updateObject<T>(dataElementId, key, change, opts));
}

// ================================================================================
// DATA DELETE FUNCTIONS
// ================================================================================

/**
 * Deletes a single object without requiring parent scope.
 * 
 * @returns Promise<boolean> - true if successful
 */
export async function deleteObject(dataElementId: string, key: string): Promise<boolean> {

    if (!userContext) {
        throw new Error("userContext is required but not available; check that the initialize function has been called");
    }

    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${dataElementId}/${key}`;
    let authToken = await lastValueFrom(getAuthToken());

    let response = await axios.delete(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
    });

    return response.status === 204;
}

/**
 * Observable version of deleteObject. See deleteObject for details.
 */
export function deleteObjectAsObservable(dataElementId: string, key: string): Observable<boolean> {
    return from(deleteObject(dataElementId, key));
}

/**
 * Deletes a single object related to a parent.
 * 
 * @returns Promise<boolean> - true if successful
 */
export async function deleteRelatedObject(parentElementId: string, parentKey: string, childElementId: string, childKey: string): Promise<boolean> {

    if (!userContext) {
        throw new Error("userContext is required but not available; check that the initialize function has been called");
    }

    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${parentElementId}/${parentKey}/${childElementId}/${childKey}`;
    let authToken = await lastValueFrom(getAuthToken());

    let response = await axios.delete(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
    });

    return response.status === 204;
}

/**
 * Observable version of deleteRelatedObject. See deleteRelatedObject for details.
 */
export function deleteRelatedObjectAsObservable(parentElementId: string, parentKey: string, childElementId: string, childKey: string): Observable<boolean> {
    return from(deleteRelatedObject(parentElementId, parentKey, childElementId, childKey));
}

/**
 * Deletes multiple objects related to a parent.
 * 
 * @param childKeys - Array of child object keys to delete
 * @returns Promise<boolean> - true if successful
 */
export async function deleteRelatedObjects(parentElementId: string, parentKey: string, childElementId: string, childKeys: string[]): Promise<boolean> {

    if (!userContext) {
        throw new Error("userContext is required but not available; check that the initialize function has been called");
    }

    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${parentElementId}/${parentKey}/${childElementId}`;
    let authToken = await lastValueFrom(getAuthToken());

    let response = await axios.delete(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
        params: { keys: childKeys.join(",") },
    });

    return response.status === 204;
}

/**
 * Observable version of deleteRelatedObjects. See deleteRelatedObjects for details.
 */
export function deleteRelatedObjectsAsObservable(parentElementId: string, parentKey: string, childElementId: string, childKeys: string[]): Observable<boolean> {
    return from(deleteRelatedObjects(parentElementId, parentKey, childElementId, childKeys));
}

// ================================================================================
// LOCAL HELPERS
// ================================================================================

function buildAccessibleObjectsParams(filter?: FilterExpression, fetchedRelationships?: string[], applyContext?: boolean, keys?: string[]): URLSearchParams | undefined {
    let params;
    if (filter || fetchedRelationships || applyContext || keys) {
        let p = {};
        if (filter) {
            (<any>p).filter = filter;
        }
        if (fetchedRelationships) {
            (<any>p).fetchedRelationships = fetchedRelationships.join(",");
        }
        if (keys) {
            (<any>p).keys = keys.join(",");
        }
        if (applyContext) {
            (<any>p).applyContext = buildApplyContextParamValue(true);
        }

        params = new URLSearchParams(p);
    }

    return params;
}

/** Reads the record version header from an axios response's headers, whatever their casing. */
function readRecordVersion(headers: any): string | undefined {
    if (!headers) {
        return undefined;
    }
    let value: unknown;
    if (typeof headers.get === 'function') {
        value = headers.get(RECORD_VERSION_HEADER);
    } else {
        const name = Object.keys(headers).find(h => h.toLowerCase() === RECORD_VERSION_HEADER.toLowerCase());
        value = name ? headers[name] : undefined;
    }
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    return String(value);
}

/** True when a failed request carries an HTTP response, so its outcome is known. */
function hasResponse(err: unknown): boolean {
    return !!err && typeof err === 'object' && !!(err as any).response;
}

/** True when the service refused a save because the record changed since it was read. */
function isRecordChangedError(err: unknown): boolean {
    return (err as any)?.response?.data?.errorCode === RECORD_CHANGED_ERROR_CODE;
}

function buildSaveQueryString(opts?: SaveOptions, includeApplyContext?: boolean): string {
    const params = new URLSearchParams();
    params.set("bypassValidation", opts?.bypassValidation === false ? "false" : "true");

    if (opts?.fetchedRelationships) {
        params.set("fetchedRelationships", opts.fetchedRelationships.join(","));
    }

    const applyContext = includeApplyContext ? buildApplyContextParamValue(false) : undefined;
    if (applyContext) {
        params.set("applyContext", applyContext);
    }

    return params.toString();
}

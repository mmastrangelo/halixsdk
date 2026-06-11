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
 * Note: for list-like displays, the `lists` module is preferred.
 * 
 * Key features:
 * - Retrieve one object a time
 * - Retrieve all objects related to a parent object
 * - Save a single object
 * - Delete a single or multiple objects
 *
 * @usage
 * ## When to Use
 * - **Read objects without specifying parent scope** → `getAccessibleObjects` (most common read)
 * - **Read specific accessible objects by key list** → `getObjects`
 * - **Get single object by key** → `getObject`
 * - **Get related objects (<50)** → `getRelatedObjects`
 * - **Create/update single object** → `saveObject`
 * - **Delete single object** → `deleteObject`
 *
 * ## When NOT to Use
 * - **Large lists (100+)** → use lists skill with `getListData`
 * - **Bulk updates** → use lists skill with `massEdit`
 * - **Aggregations** → use data-aggregate skill
 *
 * ## Key Functions
 * | Function | Use For |
 * |----------|---------|
 * | `getAccessibleObjects` | Read objects the current user can access (no parent scope needed) |
 * | `getObjects` | Read accessible objects from a specific key list |
 * | `getObject` | Single object by key |
 * | `getRelatedObjects` | Children of a parent (small collections) |
 * | `saveObject` | Create or update one object |
 * | `saveRelatedObject` | Create or update one object and establish relationship to a parent |
 * | `deleteObject` | Delete one object without parent scope |
 * | `deleteRelatedObject` | Delete one related object |
 *
 * @example
 * // Get all accessible recipes
 * const recipes = await hx.getAccessibleObjects('recipe');
 *
 * @example
 * // Get accessible recipes from a known key list
 * const recipes = await hx.getObjects('recipe', recipeKeys);
 *
 * @example
 * // Get single recipe
 * const recipe = await hx.getObject('recipe', recipeKey);
 *
 * @example
 * // Get ingredients (small collection)
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
 * // Delete a recipe
 * await hx.deleteObject('recipe', recipeKey);
 */

import axios from 'axios';
import { from, Observable, lastValueFrom } from 'rxjs';
import { sandboxKey, serviceAddress, getAuthToken, userContext } from './sdk-general';

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

    console.log("Sending GET request to " + url + " with token " + authToken);

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
 * @param filter - Optional filter; call `dataexpr_agent` to generate the filter expression. Must be less than 200 characters.
 * @param fetchedRelationships - Optional relationships to include as nested objects
 * @returns Promise<any[]>
 */
export async function getRelatedObjects(parentElementId: string, parentKey: string, elementId: string, filter?: string, fetchedRelationships?: string[]): Promise<any[]> {
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

    console.log("Sending GET request to " + url + " with token " + authToken);

    let response = await axios.get(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
        params: params,
    });

    return response.data;
}

/**
 * Observable version of getRelatedObjects. See getRelatedObjects for details.
 */
export function getRelatedObjectsAsObservable(parentElementId: string, parentKey: string, elementId: string, filter?: string, fetchedRelationships?: string[]): Observable<any[]> {
    return from(getRelatedObjects(parentElementId, parentKey, elementId, filter, fetchedRelationships));
}

/**
 * Retrieves all objects for a data element that the current user has access to.
 *
 * @param dataElementId - Data element ID
 * @param filter - Optional filter; call `dataexpr_agent` to generate the filter expression. Must be less than 200 characters.
 * @param fetchedRelationships - Optional relationships to include as nested objects
 * @param applyContext - Optional flag to apply navigation context scoping. When true, navigation context is read from UserContext.navigationContext and results are limited by the navigation context org proxy.
 * @returns Promise<any[]>
 */
export async function getAccessibleObjects(dataElementId: string, filter?: string, fetchedRelationships?: string[], applyContext?: boolean): Promise<any[]> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    let params = buildAccessibleObjectsParams(filter, fetchedRelationships, applyContext);

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${dataElementId}`;

    let authToken = await lastValueFrom(getAuthToken());

    console.log("Sending GET request to " + url + " with token " + authToken);

    let response = await axios.get(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
        params: params,
    });

    return response.data;
}

/**
 * Observable version of getAccessibleObjects. See getAccessibleObjects for details.
 */
export function getAccessibleObjectsAsObservable(dataElementId: string, filter?: string, fetchedRelationships?: string[], applyContext?: boolean): Observable<any[]> {
    return from(getAccessibleObjects(dataElementId, filter, fetchedRelationships, applyContext));
}

/**
 * Retrieves accessible objects for a data element from a specific key list.
 * Only objects that are accessible to the current user are returned. If applyContext is true, keyed objects outside the current navigation context are also omitted.
 *
 * @param dataElementId - Data element ID
 * @param keys - Object keys to retrieve
 * @param filter - Optional filter; call `dataexpr_agent` to generate the filter expression. Must be less than 200 characters.
 * @param fetchedRelationships - Optional relationships to include as nested objects
 * @param applyContext - Optional flag to apply navigation context scoping. When true, navigation context is read from UserContext.navigationContext and results are limited by the navigation context org proxy.
 * @returns Promise<any[]>
 */
export async function getObjects(dataElementId: string, keys: string[], filter?: string, fetchedRelationships?: string[], applyContext?: boolean): Promise<any[]> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    let params = buildAccessibleObjectsParams(filter, fetchedRelationships, applyContext, keys);

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${dataElementId}`;

    let authToken = await lastValueFrom(getAuthToken());

    console.log("Sending GET request to " + url + " with token " + authToken);

    let response = await axios.get(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
        params: params,
    });

    return response.data;
}

/**
 * Observable version of getObjects. See getObjects for details.
 */
export function getObjectsAsObservable(dataElementId: string, keys: string[], filter?: string, fetchedRelationships?: string[], applyContext?: boolean): Observable<any[]> {
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

    console.log("Sending POST request to " + url + " with token " + authToken);

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

    console.log("Sending POST request to " + url + " with token " + authToken);

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

    console.log("Sending DELETE request to " + url + " with token " + authToken);

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

    console.log("Sending DELETE request to " + url + " with token " + authToken);

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

    console.log("Sending DELETE request to " + url + " with token " + authToken);

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

function buildAccessibleObjectsParams(filter?: string, fetchedRelationships?: string[], applyContext?: boolean, keys?: string[]): URLSearchParams | undefined {
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

function buildApplyContextParamValue(requireNavigationContext: boolean): string | undefined {
    if (!userContext?.navigationContext) {
        if (requireNavigationContext) {
            throw new Error("navigationContext is required but not available on userContext");
        }

        return undefined;
    }

    const navigationContext = userContext.navigationContext as any;
    if (!navigationContext.navigationKey) {
        throw new Error("navigationContext is missing navigationKey");
    }

    const userProxyKey = userContext.userProxyKey ?? "";
    const orgProxyKey = userContext.orgProxyKey ?? navigationContext.orgProxyKey ?? "";
    return `${navigationContext.navigationKey}|${userProxyKey}|${orgProxyKey}`;
}

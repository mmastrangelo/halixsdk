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
 */

import axios from 'axios';
import { from, Observable, lastValueFrom } from 'rxjs';
import { sandboxKey, serviceAddress, getAuthToken, userContext } from './sdk-general';
import { FilterExpression } from './filter-expressions';

// ================================================================================
// INTERFACES
// ================================================================================

/**
 * SaveOptions is an interface for specifying save operation options.
 */
export interface SaveOptions {
    /** Whether to bypass validation */
    bypassValidation?: boolean;
}

// ================================================================================
// DATA RETRIEVAL FUNCTIONS
// ================================================================================

/**
 * getObject retrieves a single object from the database by its data element ID and key.
 * 
 * @param dataElementId - The ID of the data element
 * @param key - The key of the object
 * @param fetchedRelationships - Optional array of relationships to fetch; if provided, the returned
 * object will include the specified related objects as nested objects
 * @returns Promise resolving to the object data
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
 * getObjectAsObservable retrieves a single object from the database by its data element ID and key.
 * 
 * @param dataElementId - The ID of the data element
 * @param key - The key of the object
 * @param fetchedRelationships - Optional array of relationships to fetch; if provided, the returned
 * object will include the specified related objects as nested objects
 * 
 * @returns Observable resolving to the object data
 */
export function getObjectAsObservable(dataElementId: string, key: string, fetchedRelationships?: string[]): Observable<any> {
    return from(getObject(dataElementId, key, fetchedRelationships));
}

/**
 * getRelatedObjects retrieves an array of objects from the the database. The objects returned are
 * related to a parent through a defined relationship in the schema. In a typical setup, action's
 * auth token must have scope access to the parent object in order to access all of its related
 * objects.
 * 
 * It is common to use getRelatedObjects to retrieve all objects belonging to the current user proxy
 * or organization proxy. For example, in a user context where the current user proxy element is
 * "customer," an action might want to retrieve all "purchase" objects related to the current
 * customer. Similarly, in an organization context where the current organization proxy is
 * "business," an action might want to retrieve all "employee" objects related to the current
 * business.
 * 
 * @param parentElementId - The ID of the parent element
 * @param parentKey - The key of the parent object
 * @param elementId - The ID of the element
 * @param filter - Optional filter criteria for the query; if not provided, all related objects will
 * be returned
 * @param fetchedRelationships - Optional array of relationships to fetch; if provided, the returned
 * objects will include the specified related objects as nested objects
 * 
 * @returns Promise resolving to an array of objects
 * 
 * @see {@link FilterExpression} for filter syntax and examples
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

    console.log("Sending GET request to " + url + " with token " + authToken);

    let response = await axios.get(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
        params: params,
    });

    return response.data;
}

/**
 * getRelatedObjectsAsObservable retrieves an array of objects from the the database. The objects
 * returned are related to a parent through a defined relationship in the schema. In a typical
 * setup, action's auth token must have scope access to the parent object in order to access all of
 * its related objects.
 * 
 * It is common to use getRelatedObjects to retrieve all objects belonging to the current user proxy
 * or organization proxy. For example, in a user context where the current user proxy element is
 * "customer," an action might want to retrieve all "purchase" objects related to the current
 * customer. Similarly, in an organization context where the current organization proxy is
 * "business," an action might want to retrieve all "employee" objects related to the current
 * business.
 * 
 * @param parentElementId - The ID of the parent element
 * @param parentKey - The key of the parent element
 * @param elementId - The ID of the element
 * @param filter - Optional filter criteria for the query; if not provided, all related objects will
 * be returned
 * @param fetchedRelationships - Optional array of relationships to fetch; if provided, the returned
 * objects will include the specified related objects as nested objects
 * 
 * @returns Observable resolving to an array of objects
 * 
 * @see {@link FilterExpression} for filter syntax and examples
 */
export function getRelatedObjectsAsObservable(parentElementId: string, parentKey: string, elementId: string, filter?: FilterExpression, fetchedRelationships?: string[]): Observable<any[]> {
    return from(getRelatedObjects(parentElementId, parentKey, elementId, filter, fetchedRelationships));
}

// ================================================================================
// DATA SAVE FUNCTIONS
// ================================================================================

/**
 * saveRelatedObject saves a related object to the database. The objectToSave is saved, and its
 * relationship to the parent object is established based on the relationship specified in the
 * schema. The objectToSave must have a relationship to the parent object and the user must have
 * scope access to the parent object.
 * 
 * @param parentElementId - The ID of the parent element
 * @param parentKey - The key of the parent object
 * @param elementId - The element ID of the object to save
 * @param objectToSave - The object data to save (as a JSON string)
 * @param opts - Optional save options
 * 
 * @returns Promise resolving to saved object, including any updates made to the object during the
 * save operation (such as assigning an objKey if the object is new), or the assignment of
 * calculated values
 */
export async function saveRelatedObject(parentElementId: string, parentKey: string, elementId: string, objectToSave: string, opts?: SaveOptions): Promise<any> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${parentElementId}/${parentKey}/${elementId}`;

    if (opts?.bypassValidation === false) {
        url += "?bypassValidation=false";
    } else {
        url += "?bypassValidation=true";
    }

    let authToken = await lastValueFrom(getAuthToken());

    console.log("Sending POST request to " + url + " with token " + authToken);

    let response = await axios.post(url, objectToSave, {
        headers: { "Authorization": `Bearer ${authToken}` },
    });

    return response.data;
}

/** 
 * saveRelatedObjectAsObservable saves a related object to the database. The objectToSave is saved,
 * and its relationship to the parent object is established based on the relationship specified in
 * the schema. The objectToSave must have a relationship to the parent object and the user must have
 * scope access to the parent object.
 * 
 * @param parentElementId - The ID of the parent element
 * @param parentKey - The key of the parent object
 * @param elementId - The element ID of the object to save
 * @param objectToSave - The object data to save (as a JSON string)
 * @param opts - Optional save options
 * 
 * @returns Observable resolving to saved object, including any updates made to the object during
 * the save operation (such as assigning an objKey if the object is new), or the assignment of
 * calculated values
 */
export function saveRelatedObjectAsObservable(parentElementId: string, parentKey: string, elementId: string, objectToSave: string, opts?: SaveOptions): Observable<any> {
    return from(saveRelatedObject(parentElementId, parentKey, elementId, objectToSave, opts));
}

// ================================================================================
// DATA DELETE FUNCTIONS
// ================================================================================

/**
 * deleteRelatedObject deletes a single object related to a specific parent.
 * 
 * @param parentElementId - The ID of the parent element
 * @param parentKey - The key of the parent object
 * @param childElementId - The ID of the child element to delete
 * @param childKey - The key of the child object to delete
 * 
 * @returns Promise resolving to true if deletion was successful
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
 * deleteRelatedObjectAsObservable deletes a single object related to a specific parent.
 * 
 * @param parentElementId - The ID of the parent element
 * @param parentKey - The key of the parent object
 * @param childElementId - The ID of the child element to delete
 * @param childKey - The key of the child object to delete
 * 
 * @returns Observable resolving to true if deletion was successful
 */
export function deleteRelatedObjectAsObservable(parentElementId: string, parentKey: string, childElementId: string, childKey: string): Observable<boolean> {
    return from(deleteRelatedObject(parentElementId, parentKey, childElementId, childKey));
}

/**
 * deleteRelatedObjects deletes multiple objects related to a specific parent.
 * 
 * @param parentElementId - The ID of the parent element
 * @param parentKey - The key of the parent object
 * @param childElementId - The ID of the child element to delete
 * @param childKeys - Array of keys of the child objects to delete
 * 
 * @returns Promise resolving to true if deletion was successful
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
 * deleteRelatedObjectsAsObservable deletes multiple objects related to a specific parent.
 * 
 * @param parentElementId - The ID of the parent element
 * @param parentKey - The key of the parent object
 * @param childElementId - The ID of the child element to delete
 * @param childKeys - Array of keys of the child objects to delete
 * 
 * @returns Observable resolving to true if deletion was successful
 */
export function deleteRelatedObjectsAsObservable(parentElementId: string, parentKey: string, childElementId: string, childKeys: string[]): Observable<boolean> {
    return from(deleteRelatedObjects(parentElementId, parentKey, childElementId, childKeys));
}


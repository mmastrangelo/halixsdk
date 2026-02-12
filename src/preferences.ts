// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/preferences
 * @description Preference management functions for the Halix Platform action SDK. This module
 * provides functions for retrieving preference values.
 */

import axios from 'axios';
import { from, Observable, lastValueFrom } from 'rxjs';
import { serviceAddress, getAuthToken, userContext, sandboxKey } from './sdk-general';

// ================================================================================
// PREFERENCE RETRIEVAL FUNCTIONS
// ================================================================================

/**
 * Retrieves a preference value for the current user.
 * 
 * @param prefID - The preference ID to retrieve
 * @returns Promise<any> - the preference value
 * @throws Error if SDK not initialized or user context not available
 * 
 * @example
 * const preferenceValue = await getUserPreference('myPreferenceId');
 */
export async function getUserPreference(prefID: string): Promise<any> {
    if (!userContext?.user?.objKey) {
        const errorMessage = 'User context not available. Cannot retrieve user preference value.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    return getPreferenceInternal(prefID, 'user', userContext.user.objKey);
}

/**
 * Retrieves a preference value for the current organization.
 * 
 * @param prefID - The preference ID to retrieve
 * @returns Promise<any> - the preference value
 * @throws Error if SDK not initialized or organization context not available
 * 
 * @example
 * const preferenceValue = await getOrganizationPreference('myPreferenceId');
 */
export async function getOrganizationPreference(prefID: string): Promise<any> {
    if (!userContext?.orgKey) {
        const errorMessage = 'Organization context not available. Cannot retrieve organization preference value.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    return getPreferenceInternal(prefID, 'organization', userContext.orgKey);
}

/**
 * Observable version of getUserPreference. See getUserPreference for details.
 */
export function getUserPreferenceAsObservable(prefID: string): Observable<any> {
    return from(getUserPreference(prefID));
}

/**
 * Observable version of getOrganizationPreference. See getOrganizationPreference for details.
 */
export function getOrganizationPreferenceAsObservable(prefID: string): Observable<any> {
    return from(getOrganizationPreference(prefID));
}

async function getPreferenceInternal(prefID: string, ownerElementID: string, ownerKey: string): Promise<any> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    let url = `${serviceAddress}/sysapi/preference/${prefID}/${ownerElementID}/${ownerKey}`;

    let authToken = await lastValueFrom(getAuthToken());

    console.log("Sending GET request to " + url + " with token " + authToken);

    let response = await axios.get(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
        params: { sandboxKey },
    });

    let data = response.data;

    // Strip surrounding quotes if the value is returned as a JSON-encoded string
    if (typeof data === 'string' && data.length >= 2 && data.startsWith('"') && data.endsWith('"')) {
        data = data.slice(1, -1);
    }

    return data;
}

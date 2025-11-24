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
import { serviceAddress, getAuthToken, userContext } from './sdk-general';

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
 * const preferenceValue = await getPreference('myPreferenceId');
 */
export async function getPreference(prefID: string): Promise<any> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    if (!userContext?.user?.objKey) {
        const errorMessage = 'User context not available. Cannot retrieve preference value.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    const ownerElementID = 'user';
    const ownerKey = userContext.user.objKey;

    let url = `${serviceAddress}/sysapi/preference/${prefID}/${ownerElementID}/${ownerKey}`;

    let authToken = await lastValueFrom(getAuthToken());

    console.log("Sending GET request to " + url + " with token " + authToken);

    let response = await axios.get(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
    });

    return response.data;
}

/**
 * Observable version of getPreference. See getPreference for details.
 */
export function getPreferenceAsObservable(prefID: string): Observable<any> {
    return from(getPreference(prefID));
}



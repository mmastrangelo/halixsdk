// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/utilities
 * @description Utility functions for data manipulation and processing in the Halix Platform action SDK.
 * This module provides helper functions for common data operations that are useful across various
 * action handler scenarios.
 * 
 * Key features:
 * - sortObjectArray: In-place sorting of object arrays with multi-field priority sorting
 * - compareValues: Flexible value comparison with support for strings, numbers, and null values
 * - getValueFromObject: Extract values from nested objects using dot-notation paths
 * - debounceFn: Debounce function calls to prevent excessive execution
 */

// ================================================================================
// INTERFACES
// ================================================================================

/**
 * SortField is an interface for specifying sort fields.
 */
export interface SortField {
    /** The attribute ID to sort by */
    attributeId: string; 
    /** Whether to sort in descending order */
    descending?: boolean;
    /** Whether to perform case-insensitive comparison */
    caseInsensitive?: boolean;
    /** Whether to use auto-sequencing */
    autoSequence?: boolean;
}

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

/**
 * Sorts an array in-place by specified attributes. Supports nested attributes via dot notation (e.g., "user.name").
 * 
 * @param sort - Array of SortField with attributeId, descending?, caseInsensitive?
 * @returns The sorted array
 */
export function sortObjectArray<T>(array: Array<T>, sort: SortField[]): Array<T> {

    return array.sort((a: T, b: T) => {

        let comparison = 0;
        for (let s of sort) {
            let valueA = getValueFromObject(a, s.attributeId);
            let valueB = getValueFromObject(b, s.attributeId);

            comparison = compareValues(valueA, valueB, !!s.descending, !!s.caseInsensitive);
            if (comparison !== 0) {
                break;
            }
        }

        return comparison;
    });
}

/**
 * Compares two values for sorting. Handles strings (with optional case-insensitivity) and numbers.
 * 
 * @returns number - comparison result (-1, 0, or 1)
 */
export function compareValues(valueA: any, valueB: any, descending: boolean, caseInsensitive: boolean): number {

    if (caseInsensitive && (typeof valueA === 'string' || valueA instanceof String)) {

        if (valueA && valueB) {
            let comp = (<string>valueA).toLowerCase().localeCompare((<string>valueB).toLowerCase());
            if (descending) {
                comp = comp * -1;
            }
            return comp;
        } else if (valueA && !valueB) {
            return -1;
        } else if (!valueA && valueB) {
            return 1;                
        } else {
            return 0;
        }
    } else {

        if (valueA < valueB) {
            return (descending ? 1 : -1);
        }
        if (valueA > valueB) {
            return (descending ? -1 : 1);
        }
    }
    return 0;    
}

/**
 * Extracts a value from an object using dot-notation path. Supports relationships with colon delimiter (e.g., "accountMember:ownerAccountMemberKey").
 * 
 * @param attribute - Dot-notation path (e.g., "user.address.city")
 * @returns The extracted value
 */
export function getValueFromObject(object: any, attribute: string): any {

    let components = attribute.split(".");

    let value = object;
    for (let component of components) {

        if (value) {
            // If a relationship specifies a key, it will be in the format [datatype]:[key]. Otherwise the colon
            // delimiter will not be present.
            // The related value will be in a field named after the key. For example: accountMember:ownerAccountMemberKey
            // the related owner account member will be in a field called "ownerAccountMember".
            let compSplit = component.split(":");
            if (compSplit.length > 1) {
                let keyField = compSplit[1];
                value = value[keyField.replace("Key", "")];
            } else {
                value = value[component];
            }
        }
    }

    return value;
}

/**
 * Debounces a function call to prevent excessive execution within a short period.
 * 
 * @param wait - Milliseconds to wait (default: 200)
 * @returns Debounced function
 */
export function debounceFn<T extends (...args: any[]) => void>(fn: T, wait = 200) {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
}


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
 * @description Utility functions for the Halix Platform action SDK.
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
 * sortObjectArray is a helper function that sorts the passed array in place by the given
 * attributes. Sorting by nested attributes in the form of a delimited attribute string are
 * supported (e.g., "attribute.nestedAttribute").
 * 
 * @param array - The array to sort
 * @param sort - Array of sort field specifications
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
 * compareValues is a helper function that compares two values for sorting purposes. If the values
 * are strings, the comparison is case-insensitive. If the values are numbers, the comparison is
 * performed numerically. 
 * 
 * @param valueA - First value to compare
 * @param valueB - Second value to compare
 * @param descending - Whether to sort in descending order
 * @param caseInsensitive - Whether to perform case-insensitive comparison for strings
 * 
 * @returns Comparison result (-1, 0, or 1)
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
 * getValueFromObject is a helper function that extracts a value from an object using a dot-notation
 * path. The path can include relationships. Relationship IDs may include a colon delimiter (e.g.,
 * "accountMember:ownerAccountMemberKey") to specify the key of the related object. This is useful
 * when an element has more than one relationship to the same object type. Otherwise, if only one
 * relationship to the same object type exists, the key may be specified without the relationship ID
 * (e.g., simply, "accountMember").
 * 
 * @param object - The object to extract value from
 * @param attribute - The attribute path (e.g., "user.address.city")
 * 
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
 * debounceFn is a utility function that debounces a function call. It is used to prevent multiple
 * calls to the same function within a short period of time.
 * 
 * @param fn - The function to debounce
 * @param wait - The number of milliseconds to wait before calling the function
 * 
 * @returns The debounced function
 */
export function debounceFn<T extends (...args: any[]) => void>(fn: T, wait = 200) {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
}


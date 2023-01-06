import * as moment from 'moment';
import axios from 'axios';

export let authToken: string, sandboxKey: string, serviceAddress: string, actionSubject: string, userContext: string, params: string;

export async function getRelatedObjects(parentElementId: string, parentKey: string, elementId: string, filter: string) {

    let params;
    if (filter) {
        params = new URLSearchParams({ filter: filter});
    }

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${parentElementId}/${parentKey}/${elementId}`;

    console.log("Sending GET request to " + url + " with token " + authToken);

    let response = await axios.get(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
        params: params,
    });

    return response.data;
}

export async function getObject(dataElementId: string, key: string) {

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${dataElementId}/${key}`;

    console.log("Sending GET request to " + url + " with token " + authToken);

    let response = await axios.get(url, {
        headers: { "Authorization": `Bearer ${authToken}` },
    });

    return response.data;
}

export async function saveRelatedObject(parentElementId: string, parentKey: string, elementId: string, objectToSave: string) {

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${parentElementId}/${parentKey}/${elementId}`;

    console.log("Sending POST request to " + url + " with token " + authToken);

    let response = await axios.post(url, objectToSave, {
        headers: { "Authorization": `Bearer ${authToken}` },
    });

    return response.data;
}

/*
 * Sorts the passed array in place by the given attributes. Sorting by nested attributes in the form of a delimited
 * attribute string are supported (e.g., "attribute.nestedAttribute").
 */
export function sortObjectArray<T>(array: Array<T>, sort: SortField[]) {

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

export function getValueFromObject(object: any, attribute: string) {

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

export function prepareSuccessResponse(returnVal: any) {
    return {
        statusCode: 200, 
        body: JSON.stringify(returnVal)
    };
}

export function prepareErrorResponse(errorMessage: string) {
    return {
        statusCode: 400, 
        body: JSON.stringify({ errorMessage })
    };
}

export function initialize(event: { body?: any }) {

    let body: any = event;
    if (event.body) {
        body = event.body;
    }

    ({ authToken, sandboxKey, serviceAddress, actionSubject, userContext, params } = body);
}

export interface SortField {
    attributeId: string; 
    descending?: boolean;
    caseInsensitive?: boolean;
    autoSequence?: boolean;
}
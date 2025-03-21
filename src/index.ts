// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk
 * @description Halix Platform action SDK for developing NodeJS Lambda-based actions on the Halix
 * platform. Defines a framework for accepting incoming events from the Halix platform, making API
 * requests to the Halix data service, and returning structured action responses back to the Halix
 * platform.
 */

import axios from 'axios';
import { from, Observable } from 'rxjs';

/**
 * authToken contains the authentication token that the action handler can use to make API requests
 * to Halix web services. This value is set upon calling the initialize function with incoming event
 * data.
 */
export let authToken: string;

/**
 * sandboxKey contains the sandbox key identifier; identifies the sandbox that the action handler is
 * running in. The sandbox identifies the current solution. This value is set upon calling the
 * initialize function with incoming event data.
 */
export let sandboxKey: string;

/**
 * serviceAddress contains the URL of the Halix service that the action handler can use to make API
 * requests to. This value is set upon calling the initialize function with incoming event data.
 */
export let serviceAddress: string;

/**
 * actionSubject contains the identifier of the subject of the action. The subject is the object
 * that the action is being performed on. The action subject's contents will differ depending on the
 * context in which the action is being executed. This value is set upon calling the initialize
 * function with incoming event data.
 * - for formTemplateActions, the action subject is the data being edited on the form
 * - for pageTemplateActions, the action subject is record containing the context variables and
 *   their corresponding values on the page
 * - for objectSaveActions, the action subject is the object being saved
 * - for calculatedFieldActions, the action subject is the object containing the calculated field
 * - for singleValueActions, the action subject may differ depending on the caller
 */
export let actionSubject: string;

/**
 * userContext contains the user context information for the user that is executing the action.
 * This value is set upon calling the initialize function with incoming event data.
 */
export let userContext: string;

/**
 * params contains the parameters passed to the action. If an input dialog is used, params will
 * contain the values entered in the dialog. This value is set upon calling the initialize
 * function with incoming event data.
 */
export let params: string;

/**
 * useBody is a flag indicating how responses should be formatted. If true, the response will be
 * returned an object with the HTTP response code and ActionResponse in the body field. If false,
 * the ActionResponse will be returned directly. Typically, this does not need to be set by the
 * action handler and should remain false.
 */
export let useBody: boolean;

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
 */
export async function getRelatedObjects(parentElementId: string, parentKey: string, elementId: string, filter?: string, fetchedRelationships?: string[]): Promise<any[]> {

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
 */
export function getRelatedObjectsAsObservable(parentElementId: string, parentKey: string, elementId: string, filter?: string, fetchedRelationships?: string[]): Observable<any[]> {
    return from(getRelatedObjects(parentElementId, parentKey, elementId, filter, fetchedRelationships));
}

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

    let params;
    if (fetchedRelationships) {
        let p = {};
        if (fetchedRelationships) {
            (<any>p).fetchedRelationships = fetchedRelationships.join(",");
        }

        params = new URLSearchParams(p);
    }

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${dataElementId}/${key}`;

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

    let url = `${serviceAddress}/schema/sandboxes/${sandboxKey}/${parentElementId}/${parentKey}/${elementId}`;
    if (opts?.bypassValidation) {
        url += "?bypassValidation=true";
    }

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
 * prepareSuccessResponse prepares a success response in the appropriate format. The action handler
 * should return an ActionResponse response when the action is successful. If useBody is true, the
 * response will be returned as an object with the HTTP response code and the ActionResponse in the
 * body field. If useBody is false, the ActionResponse will be returned directly.
 * 
 * @param successResponse - The value to return
 * 
 * @returns Formatted success response; an ActionResponse unless useBody is true
 */
export function prepareSuccessResponse(successResponse: ActionResponse): { statusCode: number; body: string } | ActionResponse {
    if (useBody) {
        return {
            statusCode: 200, 
            body: JSON.stringify(successResponse)
        };            
    }
    
    return successResponse;
}

/**
 * prepareErrorResponse prepares an error response in the appropriate format. The action handler
 * should return an ErrorResponse response when the action is not successful. If useBody is true,
 * the response will be returned as an object with the HTTP response code and the ErrorResponse in
 * the body field. If useBody is false, the ErrorResponse will be returned directly.
 * 
 * @param errorMessage - The error message
 * 
 * @returns Formatted error response; an ErrorResponse unless useBody is true
 */
export function prepareErrorResponse(errorMessage: string): { statusCode: number; body: string } | ErrorResponse {
    if (useBody) {
        return {
            statusCode: 400, 
            body: JSON.stringify({ errorMessage })
        };        
    }

    return { errorMessage, responseType: "error" };
}

/**
 * initialize initializes the SDK with event data. This should be called at the beginning of the
 * action handler to set up the SDK with incoming information, including context information, input
 * parameters, and authentication information needed to make API requests to the Halix service.
 * 
 * @param event - The event object containing authentication and context information
 */
export function initialize(event: { body?: IncomingEventBody }) {

    let body: any = event;
    if (event.body) {
        body = event.body;
        useBody = true;
    }

    if (body) {
        ({ authToken, sandboxKey, serviceAddress, actionSubject, userContext, params } = body);
    }
}

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

/**
 * SaveOptions is an interface for specifying save operation options.
 */
export interface SaveOptions {
    /** Whether to bypass validation */
    bypassValidation?: boolean;
}

/**
 * BaseActionResponse is an interface defining the base properties of an action response.
 */
export interface BaseActionResponse {
    /** 
     * The type of action response 
     * 
     * listAction - Use when the action is being run from a list
     * formTemplateAction - Use when the action is being run from a form template
     * pageTemplateAction - Use when the action is being run from a page template
     * objectSaveAction - Use when the action has been specified for use on object save events
     * calculatedFieldAction - Use when the action is being used to determine calculated field values
     * singleValueAction - Use when the action is being used to determine a single value in specific
     * build-in platform events (e.g., determining shopping cart prices)
     * error - Use when the action is not successful
     */
    responseType: "listAction" | "formTemplateAction" | "pageTemplateAction" | "objectSaveAction" | "calculatedFieldAction" | "singleValueAction" | "error";
    /** Whether the action is an error */
    isError: boolean;
    /** Notification configurations; present only if the action should trigger one or more notifications */
    notificationConfigs?: NotificationConfig[];
}

/**
 * ActionResponse is an interface defining the properties of an action response.
 */
export type ActionResponse = ListActionResponse | FormTemplateActionResponse | PageTemplateActionResponse | ObjectSaveActionResponse | CalculatedFieldActionResponse | SingleValueActionResponse;

/**
 * NotificationConfig is an interface defining a notification that should be triggered by a
 * successful action response.
 */ 
export interface NotificationConfig {
    /** The ID of a notification definition setup within the solution */
    notificationDefinitionId: string;
    /** The key of the organization proxy */
    organizationProxyKey: string;
    /** The object type of the data associated with the notification */
    dataObjectType: string;
    /** The key of the data object associated with the notification */
    dataObjectKey: string;
    /** The parameters to pass to the notification */
    params: Record<string, any>;

    emailConfig?: {
        /** The type of user proxy to send the email to */
        recipientUserProxyType: string;
        /** The keys of the user proxies to send the email to */
        recipientUserProxyKeys: string[];
        /** The email address of the sender */
        fromEmailAddress?: string;
        /** The name of the sender */
        fromNameView?: string;
        /** The email address to reply to */
        replyEmailAddress?: string;
        /** The email address to send the email to; use when sending emails to non-user proxies/free-form email addresses; can contain a comma-separated list of email addresses */
        recipientEmail?: string;
    };

    smsConfig?: {
        /** The type of user proxy to send the SMS to */
        recipientUserProxyType: string;
        /** The keys of the user proxies to send the SMS to */
        recipientUserProxyKeys: string[];
        /** The phone number to send the SMS to; can contain a comma-separated list of phone numbers */
        recipientPhone: string;
    };

    pushConfig?: {
        /** The type of user proxy to send the push notification to */
        recipientUserProxyType: string;
        /** The keys of the user proxies to send the push notification to */
        recipientUserProxyKeys: string[];
        /** The navigation data to pass to the push notification */
        navigationData?: Record<string, string>;
    };   
}

/**
 * ListActionResponse is an interface defining the properties of a list action response. These
 * properties are expected by the list framework unpon receiving an action response from an action
 * handler.
 */
export interface ListActionResponse extends BaseActionResponse {
    responseType: "listAction";
    updatedSubject: any;
    successMessage: string;
}

/**
 * FormTemplateActionResponse is an interface defining the properties of a form template action
 * response. These properties are expected by the form framework unpon receiving an action response
 * from an action handler.
 */
export interface FormTemplateActionResponse extends BaseActionResponse {
    responseType: "formTemplateAction";
    updatedSubject: any;
    successMessage: string;
}

/**
 * PageTemplateActionResponse is an interface defining the properties of a page template action
 * response. These properties are expected by the page framework unpon receiving an action response
 * from an action handler.
 */
export interface PageTemplateActionResponse extends BaseActionResponse {
    responseType: "pageTemplateAction";
    successMessage: string;
    contextVariables?: Record<string, any>;
    refreshPage?: boolean;
}

/**
 * ObjectSaveActionResponse is an interface defining the properties of an object save action
 * response. These properties are expected by the object save framework unpon receiving an action
 * response from an action handler.
 */
export interface ObjectSaveActionResponse extends BaseActionResponse {
    responseType: "objectSaveAction";
    updatedSubject: any;
    successMessage: string;
}

/**
 * CalculatedFieldActionResponse is an interface defining the properties of a calculated field
 * action response. These properties are expected by the calculated field framework unpon receiving
 * an action response from an action handler.
 */
export interface CalculatedFieldActionResponse extends BaseActionResponse {
    responseType: "calculatedFieldAction";
    calculatedValue: any;
}

/**
 * SingleValueActionResponse is an interface defining the properties of a single value action
 * response. These properties are expected by the caller of the action.
 */
export interface SingleValueActionResponse extends BaseActionResponse {
    responseType: "singleValueAction";
    successMessage: string;
    value: any;
}

/**
 * ErrorResponse is an interface defining the properties of an error response.
 */
export interface ErrorResponse {
    responseType: "error";
    errorMessage: string;
}

/**
 * IncomingEventBody is an interface defining the properties of an incoming event body. The halix
 * platform provides these properties when an action is triggered.
 */
export interface IncomingEventBody {
    authToken: string;
    sandboxKey: string;
    serviceAddress: string;
    actionSubject: string;
    userContext: string;
    params: Record<string, any>;
}

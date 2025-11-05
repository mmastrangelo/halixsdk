// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/sdk-general
 * @description Core SDK globals, initialization, and common types.
 */

import { Observable, of } from 'rxjs';

// ================================================================================
// GLOBAL VARIABLES AND INITIALIZATION
// ================================================================================

/**
 * authToken contains the authentication token that the action handler can use to make API requests
 * to Halix web services. This value is set upon calling the initialize function with incoming event
 * data.
 */
export let getAuthToken: () => Observable<string>;

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
export let actionSubject: any;

/**
 * userContext contains the user context information for the user that is executing the action.
 * This value is set upon calling the initialize function with incoming event data.
 */
export let userContext: UserContext;

/**
 * params contains the parameters passed to the action. If an input dialog is used, params will
 * contain the values entered in the dialog. This value is set upon calling the initialize
 * function with incoming event data.
 */
export let params: string;

/**
 * useBody is a flag indicating how responses should be formatted. If true, the response will be
 * returned as an object with the HTTP response code and ActionResponse in the body field. If false,
 * the ActionResponse will be returned directly. Typically, this does not need to be set by the
 * action handler and should remain false.
 */
export let useBody: boolean;

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
        ({ sandboxKey, serviceAddress, actionSubject, userContext, params } = body);

        if (body.authToken) {
            getAuthToken = () => of(body.authToken);
        } else if (body.authTokenRetriever) {
            getAuthToken = body.authTokenRetriever;
        }
    }
}

// ================================================================================
// INTERFACES AND TYPES
// ================================================================================

/**
 * UserContext is an interface defining the properties of the user context.
 */
export interface UserContext {
    user: any;
    userProxy: any;
    orgProxy: any;
    orgProxyKey: string;
    orgKey: string;
    userProxyKey: string;
}

/**
 * IncomingEventBody is an interface defining the properties of an incoming event body. The halix
 * platform provides these properties when an action is triggered.
 */
export interface IncomingEventBody {
    authToken?: string;
    authTokenRetriever?: () => Observable<string>;
    sandboxKey: string;
    serviceAddress: string;
    actionSubject: any;
    userContext: UserContext;
    params: Record<string, any>;
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
    updatedSubject?: Record<string, any>;
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

// ================================================================================
// RESPONSE HELPER FUNCTIONS
// ================================================================================

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


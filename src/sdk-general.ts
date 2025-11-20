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
 * @description Core SDK module providing global variables, initialization, and common types used
 * across the entire SDK. This module includes:
 * - Global variables for authentication, service configuration, and user context
 * - initialize() function for setting up the SDK with incoming event data
 * - Action response type definitions (ListActionResponse, FormTemplateActionResponse, etc.)
 * - Response formatting helpers (prepareSuccessResponse, prepareErrorResponse)
 * - Common interfaces (UserContext, IncomingEventBody, NotificationConfig)
 * 
 * This module should be initialized by calling initialize() before using any other SDK functions.
 * The global variables are then available for use and are automatically used by other SDK functions.
 */

import { Observable, of } from 'rxjs';

// ================================================================================
// GLOBAL VARIABLES AND INITIALIZATION
// ================================================================================

/**
 * Authentication token for API requests. Set by initialize().
 */
export let getAuthToken: () => Observable<string>;

/**
 * Sandbox key identifier for the current solution. Set by initialize().
 */
export let sandboxKey: string;

/**
 * Halix service URL for API requests. Set by initialize().
 */
export let serviceAddress: string;

/**
 * Subject of the action (context-dependent: form data, page variables, object being saved, etc.). Set by initialize().
 */
export let actionSubject: any;

/**
 * User context (user, userProxy, orgProxy, keys). Set by initialize().
 */
export let userContext: UserContext;

/**
 * Parameters passed to the action (e.g., from input dialog). Set by initialize().
 */
export let params: string;

/**
 * Response format flag (internal). Typically leave as false.
 */
export let useBody: boolean;

/**
 * Initializes SDK with event data. Call at the beginning of action handler to set up authentication, context, and parameters.
 * 
 * @param event - Event object with body containing IncomingEventBody
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
 * Base properties for action responses. Use specific response types: ListActionResponse, FormTemplateActionResponse, etc.
 */
export interface BaseActionResponse {
    /** Response type: listAction, formTemplateAction, pageTemplateAction, objectSaveAction, calculatedFieldAction, singleValueAction, or error */
    responseType: "listAction" | "formTemplateAction" | "pageTemplateAction" | "objectSaveAction" | "calculatedFieldAction" | "singleValueAction" | "error";
    /** Whether the action is an error */
    isError: boolean;
    /** Optional notification configurations */
    notificationConfigs?: NotificationConfig[];
}

/**
 * ActionResponse is an interface defining the properties of an action response.
 */
export type ActionResponse = ListActionResponse | FormTemplateActionResponse | PageTemplateActionResponse | ObjectSaveActionResponse | CalculatedFieldActionResponse | SingleValueActionResponse;

/**
 * Notification configuration for triggering notifications from action responses.
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
 * Response for actions run from lists.
 */
export interface ListActionResponse extends BaseActionResponse {
    responseType: "listAction";
    updatedSubject: any;
    successMessage: string;
}

/**
 * Response for actions run from forms.
 */
export interface FormTemplateActionResponse extends BaseActionResponse {
    responseType: "formTemplateAction";
    updatedSubject: any;
    successMessage: string;
}

/**
 * Response for actions run from pages.
 */
export interface PageTemplateActionResponse extends BaseActionResponse {
    responseType: "pageTemplateAction";
    successMessage: string;
    updatedSubject?: Record<string, any>;
    refreshPage?: boolean;
}

/**
 * Response for actions triggered on object save events.
 */
export interface ObjectSaveActionResponse extends BaseActionResponse {
    responseType: "objectSaveAction";
    updatedSubject: any;
    successMessage: string;
}

/**
 * Response for actions computing calculated field values.
 */
export interface CalculatedFieldActionResponse extends BaseActionResponse {
    responseType: "calculatedFieldAction";
    calculatedValue: any;
}

/**
 * Response for actions returning a single value.
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
 * Formats a success response. Returns ActionResponse directly, or wrapped with statusCode if useBody is true.
 * 
 * @returns ActionResponse or {statusCode: 200, body: string}
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
 * Formats an error response. Returns ErrorResponse directly, or wrapped with statusCode if useBody is true.
 * 
 * @returns ErrorResponse or {statusCode: 400, body: string}
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


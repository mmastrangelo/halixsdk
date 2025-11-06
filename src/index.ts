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
 * platform. This is the main entry point that provides a unified interface for all SDK functionality.
 */

// ================================================================================
// SDK GENERAL - GLOBALS, INITIALIZATION, COMMON TYPES
// ================================================================================

export {
    // Globals
    getAuthToken,
    sandboxKey,
    serviceAddress,
    actionSubject,
    userContext,
    params,
    useBody,
    
    // Initialization
    initialize,
    
    // Common Interfaces
    type UserContext,
    type IncomingEventBody,
    
    // Action Response Types
    type BaseActionResponse,
    type ActionResponse,
    type NotificationConfig,
    type ListActionResponse,
    type FormTemplateActionResponse,
    type PageTemplateActionResponse,
    type ObjectSaveActionResponse,
    type CalculatedFieldActionResponse,
    type SingleValueActionResponse,
    type ErrorResponse,
    
    // Response Helpers
    prepareSuccessResponse,
    prepareErrorResponse
} from './sdk-general';

// ================================================================================
// DATA CRUD FUNCTIONS
// ================================================================================

export {
    // Interfaces
    type SaveOptions,
    
    // Data Retrieval
    getObject,
    getObjectAsObservable,
    getRelatedObjects,
    getRelatedObjectsAsObservable,
    
    // Data Save
    saveRelatedObject,
    saveRelatedObjectAsObservable,
    
    // Data Delete
    deleteRelatedObject,
    deleteRelatedObjectAsObservable,
    deleteRelatedObjects,
    deleteRelatedObjectsAsObservable
} from './data-crud';

// ================================================================================
// CONTENT FUNCTIONS
// ================================================================================

export {
    // Content Interface
    type ContentResource,
    
    // Content Functions
    getOrCreateResource,
    getOrCreateResourceAsObservable,
    saveResource,
    saveResourceAsObservable,
    sendFileContents,
    sendFileContentsAsObservable,
    createOrUpdateResource,
    createOrUpdateResourceAsObservable
} from './content';

// ================================================================================
// MESSAGING FUNCTIONS
// ================================================================================

export {
    // Messaging Enums
    MessageMethod,
    
    // Messaging Interfaces
    type MessageRequest,
    
    // Messaging Functions
    sendMessage,
    sendMessageAsObservable
} from './messaging';

// ================================================================================
// FILTER EXPRESSIONS
// ================================================================================

export {
    type FilterExpression
} from './filter-expressions';

// ================================================================================
// LIST DATA FUNCTIONS
// ================================================================================

export { 
    // Interfaces
    type SortField,
    type DataSortField,
    type BaseListDataRequest,
    type PagedListDataRequest,
    type ListDataResponse,
    type ListDataOptions,
    type ListDataSearchOptions,
    type MassEditValueType,
    type MassEditRequest,
    type MassDeleteRequest,
    type MassChangeResponse,
    
    // Functions
    getListData, 
    getListDataAsObservable,
    massEdit,
    massEditAsObservable,
    massDelete,
    massDeleteAsObservable
} from './lists';

// ================================================================================
// UTILITY FUNCTIONS
// ================================================================================

export {
    sortObjectArray,
    compareValues,
    getValueFromObject,
    debounceFn
} from './utilities';

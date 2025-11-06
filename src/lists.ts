// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/lists
 * @description List data retrieval and bulk operations. Use this to efficiently retrieve objects
 * from the database for display in list-like user interfaces. This is preferred over
 * the `data-crud` module when showing one page of data at a time.
 * 
 * Key features:
 * - Efficient retrieval of one page of data at a time
 * - Pagination
 * - Sorting
 * - Filtering
 * - Search
 * - Mass edit operations (bulk update multiple records)
 * - Mass delete operations (bulk delete multiple records)
 */

import axios from 'axios';
import { from, Observable, lastValueFrom } from 'rxjs';
import { sandboxKey, serviceAddress, getAuthToken } from './sdk-general';
import { FilterExpression } from './filter-expressions';

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

/**
 * DataSortField represents a single sort field, wrapping an attribute ID and sort direction.
 */
export interface DataSortField {
    /** The ID of the attribute to sort by (can include relationship paths with dots, e.g. "customer.lastName") */
    attributeId: string;
    /** Whether to sort in descending order (true) or ascending order (false, default) */
    descending?: boolean;
}

/**
 * BaseListDataRequest defines the core properties for list data requests.
 * This is used to define the scope and filtering of records without pagination.
 */
export interface BaseListDataRequest {
    /** 
     * The ID of the root data element to retrieve.
     */
    dataElementId: string;

    /** 
     * Sort configuration - list of sort fields in priority order.
     * Each field can include relationship paths (e.g., "customer.lastName").
     */
    sort?: DataSortField[];

    /** 
     * The ID of the data element that defines the overall scope of records.
     * The dataElementId must be related to this through a foreign key or key array.
     * Works with parentKey to scope results. This is often an organization proxy
     * or user proxy element, but not necessarily so.
     */
    parentDataElementId: string;

    /** 
     * The key of an object that all records must be related to.
     * Works with parentDataElementId to scope results.
     */
    parentKey?: string;

    /** 
     * Optional field to specify the foreign key field on the root element that defines
     * the relationship to the parent. If omitted, a derived key is assumed.
     */
    parentKeyField?: string;

    /** 
     * Optional property to specify the relationship field for foreignKeySet relationships.
     * Required when parent has multiple relationships to the child element.
     */
    childKeysField?: string;

    /** 
     * Filter expression to limit results. Evaluated within the parent key scope.
     * @see {@link FilterExpression} for filter syntax and examples
     */
    filter?: FilterExpression;

    /** 
     * List of fields being displayed on the list. Only these fields are populated in
     * returned objects to reduce payload size. If fields include relationship paths,
     * those relationships are automatically retrieved.
     */
    displayFields?: string[];

    /** 
     * Additional field values to include that may not be in displayFields, sort, or filters.
     */
    additionalFieldsToFetch?: string[];
}

/**
 * PagedListDataRequest extends BaseListDataRequest with pagination properties.
 * This is used for paginated list data retrieval.
 */
export interface PagedListDataRequest extends BaseListDataRequest {
    /** 
     * The 1-based page number to retrieve. Works with pageSize.
     */
    pageNumber?: number;

    /** 
     * The number of records per page. Works with pageNumber.
     */
    pageSize?: number;
}

/**
 * ListDataResponse wraps a data provider response to a list data request.
 */
export interface ListDataResponse {
    /** 
     * A slice of the appropriate runtime struct type containing a single page-worth of data.
     * The actual type of objects in this array depends on the dataElementId being queried.
     */
    data: any[];
    
    /** The total number of entries across all pages */
    total: number;
    
    /** 
     * The index within the data array of the selected row. 
     * This value is provided when a search term is included in the data request.
     */
    selectedRow: number;
    
    /** The 1-based page number included in this response */
    pageNumber: number;
}

/**
 * ListDataSearchOptions is an interface defining the search options for list data retrieval.
 */
export interface ListDataSearchOptions {
    /** The attribute ID to search by */
    attributeId: string;
    /** The value to search for */
    value: string;
    /** The total number of items in the list */
    total: number;
}

/**
 * ListDataOptions is an interface defining options for list data retrieval.
 */
export interface ListDataOptions {
    /** Whether to access the public endpoint (no authentication required) */
    isPublic?: boolean;
    /** Whether to bypass total count calculation for performance */
    bypassTotal?: boolean;
    /** 
     * Search options for binary search functionality; if provided, the response will include
     * the page of data that contains the first occurrence of the search value. The selectedRow
     * property will be set to the index of the first occurrence of the search value.
     */
    search?: ListDataSearchOptions;
}

/**
 * MassEditValueType specifies how the value should be interpreted for mass edit operations.
 * - 'literal': The value is a literal value to set
 * - 'property': The value is a property ID to copy from
 */
export type MassEditValueType = 'literal' | 'property';

/**
 * MassEditRequest defines a request to update multiple records at once.
 * 
 * The keys array must contain object keys that are a subset of the records covered by
 * the dataRequest. The dataRequest serves as a security scoping mechanism - only records
 * that would be returned by the dataRequest (ignoring pagination) can be updated. This
 * ensures efficient security checks without requiring individual permission checks per record.
 */
export interface MassEditRequest {
    /** 
     * Array of object keys to update. Must be a subset of records covered by dataRequest.
     */
    keys: string[];
    /** 
     * List data request defining the security scope of records that can be updated.
     * Pagination fields (pageNumber, pageSize) are ignored.
     */
    dataRequest: BaseListDataRequest;
    /** The data element ID of the objects to update */
    dataElementId: string;
    /** The property/attribute ID to update */
    property: string;
    /** How to interpret the value ('literal' or 'property') */
    valueType: MassEditValueType;
    /** The value to set (interpretation depends on valueType) */
    value?: any;
}

/**
 * MassDeleteRequest defines a request to delete multiple records at once.
 * 
 * The keys array must contain object keys that are a subset of the records covered by
 * the dataRequest. The dataRequest serves as a security scoping mechanism - only records
 * that would be returned by the dataRequest (ignoring pagination) can be deleted. This
 * ensures efficient security checks without requiring individual permission checks per record.
 */
export interface MassDeleteRequest {
    /** 
     * Array of object keys to delete. Must be a subset of records covered by dataRequest.
     */
    keys: string[];
    /** 
     * List data request defining the security scope of records that can be deleted.
     * Pagination fields are not applicable.
     */
    dataRequest: BaseListDataRequest;
    /** The data element ID of the objects to delete */
    dataElementId: string;
    /** If true, delete all objects returned by dataRequest (ignores keys) */
    emptyList?: boolean;
}

/**
 * MassChangeResponse contains the results of a mass edit or mass delete operation.
 */
export interface MassChangeResponse {
    /** Number of records attempted */
    tried: number;
    /** Number of records successfully updated/deleted */
    succeeded: number;
    /** Number of records that failed */
    failed: number;
}

// ================================================================================
// LIST DATA RETRIEVAL FUNCTIONS
// ================================================================================

/**
 * getListData retrieves list data from the Halix platform. This function can operate in four
 * different modes based on the provided options:
 * 
 * 1. Authenticated list data retrieval (default)
 * 2. Public list data retrieval (when isPublic is true)
 * 3. Authenticated list data with search (when search options are provided)
 * 4. Public list data with search (when both isPublic and search options are provided)
 * 
 * The search functionality uses binary search to efficiently locate items in a sorted list by
 * a specific attribute value.
 * 
 * @param request - The list data request containing list configuration and parameters
 * @param options - Optional configuration for the request
 * 
 * @returns Promise resolving to the list data response
 * 
 * @example
 * // Basic authenticated list data retrieval
 * const listData = await getListData({
 *   dataElementId: 'customer',
 *   parentDataElementId: 'company',
 *   parentKey: orgProxyKey,
 *   pageNumber: 1,
 *   pageSize: 50,
 *   displayFields: ['firstName', 'lastName', 'email']
 * });
 * console.log('Total customers:', listData.total);
 * console.log('Page:', listData.pageNumber);
 * console.log('Data:', listData.data);
 * 
 * @example
 * // Public list data retrieval without authentication
 * const publicData = await getListData({
 *   dataElementId: 'product',
 *   parentDataElementId: 'catalog',
 *   parentKey: orgProxyKey,
 *   pageNumber: 1,
 *   pageSize: 20
 * }, { isPublic: true });
 * 
 * @example
 * // List data retrieval with binary search
 * const searchData = await getListData({
 *   dataElementId: 'purchases',
 *   parentDataElementId: 'customer',
 *   parentKey: userProxyKey,
 *   sort: [{ attributeId: 'invoiceNumber', descending: false }]
 * }, {
 *   search: {
 *     attributeId: 'invoiceNumber',
 *     value: 'INV-123456',
 *     total: 1000
 *   }
 * });
 * console.log('Selected row index:', searchData.selectedRow);
 */
export async function getListData(request: PagedListDataRequest, options?: ListDataOptions): Promise<ListDataResponse> {

    const isPublic = options?.isPublic ?? false;
    const hasSearch = !!options?.search;

    // Determine which endpoint to use based on public access and search requirements
    let url: string;
    if (hasSearch && isPublic) {
        url = `${serviceAddress}/list/sandboxes/${sandboxKey}/public/listdataSearch`;
    } else if (hasSearch && !isPublic) {
        url = `${serviceAddress}/list/sandboxes/${sandboxKey}/listdataSearch`;
    } else if (!hasSearch && isPublic) {
        url = `${serviceAddress}/list/sandboxes/${sandboxKey}/public/listdata`;
    } else {
        url = `${serviceAddress}/list/sandboxes/${sandboxKey}/listdata`;
    }

    // Build query parameters
    let params: any = {};
    
    // Add bypassTotal parameter if specified
    if (options?.bypassTotal !== undefined) {
        params.bypassTotal = options.bypassTotal;
    }
    
    // Add search parameters if search is enabled
    if (hasSearch && options?.search) {
        params.attributeId = options.search.attributeId;
        params.value = options.search.value;
        params.total = options.search.total.toString();
    }

    // Build headers with authentication token for non-public endpoints
    let headers: any = {};
    if (!isPublic) {
        let authToken = await lastValueFrom(getAuthToken());
        headers.Authorization = `Bearer ${authToken}`;
        
        console.log("Sending POST request to " + url + " with token " + authToken);
    } else {
        console.log("Sending POST request to " + url + " (public endpoint)");
    }

    // Make the API request
    let response = await axios.post(url, request, {
        headers,
        params: Object.keys(params).length > 0 ? params : undefined,
    });

    return response.data;
}

/**
 * getListDataAsObservable retrieves list data from the Halix platform as an Observable. This
 * function operates in the same four modes as getListData.
 * 
 * @param request - The list data request containing list configuration and parameters
 * @param options - Optional configuration for the request
 * 
 * @returns Observable resolving to the list data response
 * 
 * @example
 * // Basic authenticated list data retrieval as Observable
 * getListDataAsObservable({
 *   dataElementId: 'customer',
 *   parentDataElementId: 'company',
 *   parentKey: userContext.orgProxyKey,
 *   pageNumber: 1,
 *   pageSize: 50
 * }).subscribe(response => {
 *   console.log('Total customers:', response.total);
 *   console.log('Page:', response.pageNumber);
 *   console.log('Data:', response.data);
 * });
 */
export function getListDataAsObservable(request: PagedListDataRequest, options?: ListDataOptions): Observable<ListDataResponse> {
    return from(getListData(request, options));
}

// ================================================================================
// MASS EDIT AND DELETE FUNCTIONS
// ================================================================================

/**
 * massEdit performs a bulk update operation on multiple records. This function allows you to
 * update a specific property on multiple objects in a single request.
 * 
 * **Security Scoping**: The dataRequest serves as a security boundary. Only records that would
 * be returned by the dataRequest can be updated. The keys array must reference records within
 * this scope. This allows efficient security validation without checking each record individually.
 * 
 * The value can be set in two ways based on valueType:
 * - 'literal': Set the property to a literal value
 * - 'property': Copy the value from another property on the same object
 * 
 * @param request - The mass edit request specifying what to update and how
 * 
 * @returns Promise resolving to statistics about the operation
 * 
 * @example
 * // Update the status of multiple orders to 'shipped'
 * const result = await massEdit({
 *   keys: ['order-123', 'order-456', 'order-789'],
 *   dataRequest: {
 *     dataElementId: 'order',
 *     parentDataElementId: 'company',
 *     parentKey: orgProxyKey
 *   },
 *   dataElementId: 'order',
 *   property: 'status',
 *   valueType: 'literal',
 *   value: 'shipped'
 * });
 * console.log(`Updated ${result.succeeded} of ${result.tried} orders`);
 * 
 * @example
 * // Copy shipping address to billing address for multiple customers
 * const result = await massEdit({
 *   keys: selectedCustomerKeys,
 *   dataRequest: {
 *     dataElementId: 'customer',
 *     parentDataElementId: 'company',
 *     parentKey: orgProxyKey
 *   },
 *   dataElementId: 'customer',
 *   property: 'billingAddress',
 *   valueType: 'property',
 *   value: 'shippingAddress'
 * });
 */
export async function massEdit(request: MassEditRequest): Promise<MassChangeResponse> {
    const url = `${serviceAddress}/list/sandboxes/${sandboxKey}/massedit`;

    // Build headers with authentication token
    let authToken = await lastValueFrom(getAuthToken());
    let headers: any = {
        Authorization: `Bearer ${authToken}`
    };

    console.log("Sending POST request to " + url + " with token " + authToken);

    // Make the API request
    let response = await axios.post(url, request, { headers });

    return response.data;
}

/**
 * massEditAsObservable performs a bulk update operation on multiple records, returning an Observable.
 * See massEdit for detailed documentation.
 * 
 * @param request - The mass edit request specifying what to update and how
 * 
 * @returns Observable resolving to statistics about the operation
 * 
 * @example
 * massEditAsObservable({
 *   keys: ['order-123', 'order-456'],
 *   dataRequest: {
 *     dataElementId: 'order',
 *     parentDataElementId: 'company',
 *     parentKey: orgProxyKey
 *   },
 *   dataElementId: 'order',
 *   property: 'status',
 *   valueType: 'literal',
 *   value: 'shipped'
 * }).subscribe(result => {
 *   console.log(`Updated ${result.succeeded} of ${result.tried} orders`);
 * });
 */
export function massEditAsObservable(request: MassEditRequest): Observable<MassChangeResponse> {
    return from(massEdit(request));
}

/**
 * massDelete performs a bulk delete operation on multiple records. This function allows you to
 * soft-delete multiple objects in a single request.
 * 
 * **Security Scoping**: The dataRequest serves as a security boundary. Only records that would
 * be returned by the dataRequest can be deleted. The keys array must reference records within
 * this scope. This allows efficient security validation without checking each record individually.
 * 
 * If emptyList is set to true, all records returned by the dataRequest will be deleted,
 * ignoring the keys array.
 * 
 * @param request - The mass delete request specifying what to delete
 * 
 * @returns Promise resolving to statistics about the operation
 * 
 * @example
 * // Delete specific orders
 * const result = await massDelete({
 *   keys: ['order-123', 'order-456', 'order-789'],
 *   dataRequest: {
 *     dataElementId: 'order',
 *     parentDataElementId: 'company',
 *     parentKey: orgProxyKey,
 *     filter: { field: 'status', operator: '==', value: 'cancelled' }
 *   },
 *   dataElementId: 'order'
 * });
 * console.log(`Deleted ${result.succeeded} of ${result.tried} orders`);
 * 
 * @example
 * // Delete all records matching the filter
 * const result = await massDelete({
 *   keys: [],
 *   dataRequest: {
 *     dataElementId: 'tempRecord',
 *     parentDataElementId: 'company',
 *     parentKey: orgProxyKey,
 *     filter: { field: 'createdDate', operator: '<', value: '2023-01-01' }
 *   },
 *   dataElementId: 'tempRecord',
 *   emptyList: true
 * });
 * console.log(`Deleted ${result.succeeded} old records`);
 */
export async function massDelete(request: MassDeleteRequest): Promise<MassChangeResponse> {
    const url = `${serviceAddress}/list/sandboxes/${sandboxKey}/massdelete`;

    // Build headers with authentication token
    let authToken = await lastValueFrom(getAuthToken());
    let headers: any = {
        Authorization: `Bearer ${authToken}`
    };

    console.log("Sending POST request to " + url + " with token " + authToken);

    // Make the API request
    let response = await axios.post(url, request, { headers });

    return response.data;
}

/**
 * massDeleteAsObservable performs a bulk delete operation on multiple records, returning an Observable.
 * See massDelete for detailed documentation.
 * 
 * @param request - The mass delete request specifying what to delete
 * 
 * @returns Observable resolving to statistics about the operation
 * 
 * @example
 * massDeleteAsObservable({
 *   keys: ['order-123', 'order-456'],
 *   dataRequest: {
 *     dataElementId: 'order',
 *     parentDataElementId: 'company',
 *     parentKey: orgProxyKey
 *   },
 *   dataElementId: 'order'
 * }).subscribe(result => {
 *   console.log(`Deleted ${result.succeeded} of ${result.tried} orders`);
 * });
 */
export function massDeleteAsObservable(request: MassDeleteRequest): Observable<MassChangeResponse> {
    return from(massDelete(request));
}

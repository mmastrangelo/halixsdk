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
 * @description List data retrieval functions for the Halix Platform action SDK.
 */

import axios from 'axios';
import { from, Observable, lastValueFrom } from 'rxjs';
import { sandboxKey, serviceAddress, getAuthToken } from './sdk-general';

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
 * ListDataRequest is an interface defining the properties of a list data request.
 * This request is used to retrieve list data from the Halix platform.
 */
export interface ListDataRequest {
    /** 
     * The ID of the root data element to retrieve.
     */
    dataElementId: string;

    /** 
     * The 1-based page number to retrieve. Works with pageSize.
     * Alternatively, you can use traditional offset/limit pagination.
     */
    pageNumber?: number;

    /** 
     * The number of records per page. Works with pageNumber.
     */
    pageSize?: number;

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
     * Filter fields can include relationship paths (e.g., "customer.status eq 'active'").
     */
    filter?: string;

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
export async function getListData(request: ListDataRequest, options?: ListDataOptions): Promise<ListDataResponse> {

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
export function getListDataAsObservable(request: ListDataRequest, options?: ListDataOptions): Observable<ListDataResponse> {
    return from(getListData(request, options));
}


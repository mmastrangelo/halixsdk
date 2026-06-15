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
 * - Supports related object retrieval
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
import type { FilterExpression } from './filter-expression';

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
     * 
     * Note: in most cases, this can be omitted in which case the system will automatically
     * return only the records the user can access.
     */
    parentDataElementId?: string;

    /** 
     * The key of an object that all records must be related to.
     * Works with parentDataElementId to scope results.
     * 
     * Note: in most cases, this can be omitted in which case the system will automatically
     * return only the records the user can access.
     */
    parentKey?: string;

    /** 
     * Optional field to specify the foreign key field on the root element that defines
     * the relationship to the parent. If omitted, a derived key is assumed. Works with parentDataElementId to scope results.
     */
    parentKeyField?: string;

    /** 
     * Optional property to specify the relationship field for foreignKeySet relationships.
     * Required when parent has multiple relationships to the child element.
     */
    childKeysField?: string;

    /** 
     * Halix filter expression to limit results. Evaluated within the parent key scope.
     * This is not SQL or JavaScript syntax. Call `build_filter_expression` to generate
     * the filter expression. Must be less than 200 characters.
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
 *
 * Rows are returned in the `data` array. Do not read `objects`, `items`, or
 * the response object itself as the row array. `total` is the total matching
 * record count across all pages for this request. When `total > data.length`,
 * the current response is only one page of a larger result set.
 */
export interface ListDataResponse {
    /** 
     * A slice of the appropriate runtime struct type containing a single page-worth of data.
     * The actual type of objects in this array depends on the dataElementId being queried.
     */
    data: any[];
    
    /**
     * The total number of matching entries across all pages for this request.
     * If total is greater than data.length, more pages exist. A caller that is
     * building a complete report/chart must request additional pages, use an
     * aggregate endpoint, narrow the query with filters/key lists, or present
     * the result as a capped/partial view.
     */
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
 * Retrieves paginated list data. Supports authenticated/public access, filtering, sorting, and binary search.
 * 
 * Common usage:
 * - Use `getListData` when you need list-specific behavior: pagination, explicit totals,
 *   server-side sort/filter, field projection, search, selection, or bulk operations.
 * - Do not choose `getListData` only because the task is a report. Prefer `getAccessibleObjects`
 *   for bounded accessible-record reads without list behavior, `getRelatedObjects` when a
 *   concrete parent key is already known, or `getAggregateData` for grouped counts/sums.
 * - For most custom-element list UIs, start with only `dataElementId`, pagination fields,
 *   and `displayFields`.
 * - Omit `parentDataElementId` and `parentKey` when you want the records the current user
 *   can already access.
 * - Add `parentDataElementId` and `parentKey` only when the list must be anchored to a
 *   specific parent record.
 * - Most callers should omit `options`. Use `options.search` only for binary-search
 *   navigation scenarios, and use `options.bypassTotal` only when you explicitly do not
 *   need the total count.
 * - For bounded report reads that genuinely need list behavior, set `pageNumber`, an explicit
 *   `pageSize`, `displayFields`, and `additionalFieldsToFetch` for every field used in filtering,
 *   grouping, sorting, aggregation, or rendering.
 *
 * Response shape:
 * - `response.data` is the row array.
 * - `response.total` is the total matching record count across all pages when
 *   requested. If `response.total > response.data.length`, this response is
 *   a page slice, not the full result set.
 * - Do not read `response.objects`, `response.items`, or the response object itself as
 *   the row array.
 *
 * Pagination guidance:
 * - Use `response.total` to decide whether the current page covers the full
 *   query. For page 1 with pageSize 100 and total 5,000, local aggregation over
 *   `response.data` covers only the first 100 rows.
 * - Do not treat a first page or large page as complete report data just because
 *   it contains rows.
 * 
 * Request shape:
 * - `dataElementId` (required): root data element to retrieve
 * - `pageNumber` / `pageSize` (optional): pagination
 * - `displayFields` (optional): fields to populate in returned objects
 * - `additionalFieldsToFetch` (optional): extra fields needed for local logic or rendering
 * - `sort` (optional): sort fields such as `[{ attributeId: 'name' }]`
 * - `filter` (optional): filter expression
 * - `parentDataElementId` / `parentKey` (optional): explicit parent scope
 * 
 * @param request - List configuration including dataElementId, parentDataElementId, parentKey, pagination, sort, filter
 * @param options - Optional: isPublic, bypassTotal, search
 * @returns Promise<ListDataResponse> with data array, total count, pageNumber
 * 
 * @example
 * // Most common case: one page of records the current user can access.
 * const response = await getListData({
 *   dataElementId: 'student',
 *   pageNumber: 1,
 *   pageSize: 10,
 *   displayFields: ['name', 'studentNumber', 'email', 'grade']
 * });
 * const rows = response.data;
 * 
 * @example
 * // Custom element pagination with an optional sort.
 * const response = await getListData({
 *   dataElementId: 'student',
 *   pageNumber: currentPage,
 *   pageSize: 10,
 *   displayFields: ['name', 'studentNumber', 'email', 'grade'],
 *   sort: [{ attributeId: 'name' }]
 * });
 * const rows = response.data;
 * 
 * @example
 * // Explicit parent scoping when the list must be anchored to a specific parent.
 * const listData = await getListData({
 *   dataElementId: 'customer',
 *   parentDataElementId: 'company',
 *   parentKey: orgProxyKey,
 *   pageNumber: 1,
 *   pageSize: 50,
 *   displayFields: ['firstName', 'lastName', 'email']
 * });
 * const rows = listData.data;
 * 
 * @example
 * // options is rarely needed; omit it unless you need one of these behaviors.
 * const response = await getListData(
 *   {
 *     dataElementId: 'student',
 *     pageNumber: 1,
 *     pageSize: 10,
 *     displayFields: ['name']
 *   },
 *   {
 *     search: {
 *       attributeId: 'name',
 *       value: 'Ada',
 *       total: 100
 *     }
 *   }
 * );
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
        if (!getAuthToken) {
            const errorMessage = 'SDK not initialized.';
            console.error(errorMessage);
            throw new Error(errorMessage);
        }
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
 * Observable version of getListData. See getListData for details.
 * 
 * @example
 * getListDataAsObservable({ dataElementId: 'customer', parentDataElementId: 'company', parentKey: orgProxyKey })
 *   .subscribe(response => console.log(response.data));
 */
export function getListDataAsObservable(request: PagedListDataRequest, options?: ListDataOptions): Observable<ListDataResponse> {
    return from(getListData(request, options));
}

// ================================================================================
// MASS EDIT AND DELETE FUNCTIONS
// ================================================================================

/**
 * Bulk update multiple records. The dataRequest defines security scope; only records within that scope can be updated.
 * Use valueType 'literal' to set a value, or 'property' to copy from another field.
 * 
 * @param request - keys[], dataRequest (scope), dataElementId, property, valueType, value
 * @returns Promise<MassChangeResponse> with tried/succeeded/failed counts
 * 
 * @example
 * const result = await massEdit({
 *   keys: ['order-123', 'order-456'],
 *   dataRequest: { dataElementId: 'order', parentDataElementId: 'company', parentKey: orgProxyKey },
 *   dataElementId: 'order',
 *   property: 'status',
 *   valueType: 'literal',
 *   value: 'shipped'
 * });
 */
export async function massEdit(request: MassEditRequest): Promise<MassChangeResponse> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
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
 * Observable version of massEdit. See massEdit for details.
 */
export function massEditAsObservable(request: MassEditRequest): Observable<MassChangeResponse> {
    return from(massEdit(request));
}

/**
 * Bulk soft-delete multiple records. The dataRequest defines security scope; only records within that scope can be deleted.
 * Set emptyList: true to delete all records matching dataRequest (ignores keys array).
 * 
 * @param request - keys[], dataRequest (scope), dataElementId, emptyList?
 * @returns Promise<MassChangeResponse> with tried/succeeded/failed counts
 * 
 * @example
 * const result = await massDelete({
 *   keys: ['order-123', 'order-456'],
 *   dataRequest: { dataElementId: 'order', parentDataElementId: 'company', parentKey: orgProxyKey },
 *   dataElementId: 'order'
 * });
 */
export async function massDelete(request: MassDeleteRequest): Promise<MassChangeResponse> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
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
 * Observable version of massDelete. See massDelete for details.
 */
export function massDeleteAsObservable(request: MassDeleteRequest): Observable<MassChangeResponse> {
    return from(massDelete(request));
}

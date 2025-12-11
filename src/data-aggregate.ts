// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/data-aggregate
 * @description Data aggregation operations for the Halix Platform action SDK. This module provides functions
 * for performing aggregate queries (count, sum, average, etc.) on data objects grouped by specified fields.
 * Results are returned as aggregated data suitable for charts, reports, and analytics dashboards.
 *
 * Key features:
 * - Group data by one or more fields
 * - Apply transformations to grouping fields (date functions, string functions)
 * - Calculate aggregations (count, sum, average, min, max, median)
 * - Sort aggregated results
 * - Filter data before aggregation
 * - Parent-child relationship scoping for security
 */

import axios from 'axios';
import { from, Observable, lastValueFrom } from 'rxjs';
import { sandboxKey, serviceAddress, getAuthToken } from './sdk-general';

// ================================================================================
// INTERFACES
// ================================================================================

/**
 * TransformType specifies the type of transformation to apply to a group field.
 */
export type TransformType =
    | 'Year' | 'Month' | 'Week' | 'Day' | 'Hour' | 'Minute'
    | 'Substring';

/**
 * AggregationType specifies the type of aggregation to perform on a field.
 */
export type AggregationType =
    | 'Average' | 'Count' | 'Sum' | 'Max' | 'Min' | 'Median';

/**
 * AggregationGroupTransform represents a transform function with parameters to be applied to a group field.
 */
export interface AggregationGroupTransform {
    /** The transformation function to apply */
    transform: TransformType;
    /** Arguments for the transformation function */
    args?: { [key: string]: any };
}

/**
 * AggregationGroup defines a grouping field with optional transforms and sort direction.
 */
export interface AggregationGroup {
    /** The field to group by (can include relationship paths with dots, e.g. "customer.lastName") */
    groupField: string;
    /** Sort direction for this group ('asc' or 'desc') */
    groupDirection: 'asc' | 'desc';
    /** Optional transforms to apply to the grouping field */
    transforms?: AggregationGroupTransform[];
}

/**
 * AggregationSort defines a secondary sort field for aggregated results.
 */
export interface AggregationSort {
    /** The field to sort by (can include relationship paths with dots) */
    sortField: string;
    /** Sort direction ('asc' or 'desc') */
    sortDirection: 'asc' | 'desc';
    /** The aggregation type to sort by (must match an aggregation in the request) */
    sortAggregation: AggregationType;
}

/**
 * Aggregation defines an aggregation operation to perform on a field.
 */
export interface Aggregation {
    /** The aggregation function to apply ('Average', 'Count', 'Sum', 'Max', 'Min', 'Median') */
    aggregation: AggregationType;
    /** The field to aggregate (can include relationship paths with dots) */
    aggregationField: string;
}

/**
 * AggregationRequest defines the parameters for an aggregation query.
 * The data scope is controlled by parentDataElementId, parentKey, and dataElementId.
 */
export interface AggregationRequest {
    /**
     * The ID of the data element to aggregate.
     */
    dataElementId: string;

    /**
     * The ID of the parent data element that defines the overall scope of records.
     * The dataElementId must be related to this through a foreign key or key array.
     */
    parentDataElementId?: string;

    /**
     * The key of a parent object that all records must be related to.
     * Works with parentDataElementId to scope results.
     */
    parentKey?: string;

    /**
     * Optional field to specify the foreign key field on the data element that defines
     * the relationship to the parent. If omitted, a derived key is assumed.
     */
    parentKeyField?: string;

    /**
     * Filter expression to limit records before aggregation.
     * @see the filter-expressions module for filter syntax and examples
     */
    filter?: string;

    /**
     * List of grouping specifications. Groups are formed by field values with optional transforms.
     * Results will be grouped by these fields in the order specified.
     */
    groups: AggregationGroup[];

    /**
     * List of secondary sort specifications for the aggregated results.
     * Groups are the primary sorts; these are additional sorting criteria.
     */
    sort?: AggregationSort[];

    /**
     * List of aggregation operations to perform on the grouped data.
     */
    aggregations: Aggregation[];
}

/**
 * AggregationResponse wraps the aggregated data results.
 */
export interface AggregationResponse {
    /** The aggregated data results */
    data: any[];
}

// ================================================================================
// DATA AGGREGATION FUNCTIONS
// ================================================================================

/**
 * Performs data aggregation operations (count, sum, average, etc.) on grouped data.
 * Supports filtering, grouping with transforms, sorting, and multiple aggregations.
 *
 * @param request - Aggregation configuration including dataElementId, parent scope, groups, aggregations
 * @returns Promise<AggregationResponse> with aggregated data array
 *
 * @example
 * const results = await getAggregateData({
 *   dataElementId: 'order',
 *   parentDataElementId: 'company',
 *   parentKey: orgProxyKey,
 *   groups: [{
 *     groupField: 'status',
 *     groupDirection: 'asc'
 *   }],
 *   aggregations: [{
 *     aggregation: 'Count',
 *     aggregationField: 'objKey'
 *   }, {
 *     aggregation: 'Sum',
 *     aggregationField: 'totalAmount'
 *   }]
 * });
 */
export async function getAggregateData(request: AggregationRequest): Promise<AggregationResponse> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    const url = `${serviceAddress}/sandboxes/${sandboxKey}/aggregateData`;

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
 * Observable version of getAggregateData. See getAggregateData for details.
 *
 * @example
 * getAggregateDataAsObservable({
 *   dataElementId: 'order',
 *   groups: [{ groupField: 'status', groupDirection: 'asc' }],
 *   aggregations: [{ aggregation: 'Count', aggregationField: 'objKey' }]
 * }).subscribe(response => console.log(response.data));
 */
export function getAggregateDataAsObservable(request: AggregationRequest): Observable<AggregationResponse> {
    return from(getAggregateData(request));
}

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
    groups?: AggregationGroup[];

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
 * AggregationRow represents a single row in the aggregated results.
 * Contains dynamic fields for groups and aggregations.
 */
export interface AggregationRow {
    [key: string]: any;
}

/**
 * AggregationResponse provides structured access to aggregated data results.
 * Each row contains:
 * - Group fields named after their groupField property
 * - Aggregation fields named as {aggregationType}_{aggregationField} (e.g., "count_objKey", "sum_totalAmount")
 */
export class AggregationResponse {
    private rawData: AggregationRow[];

    constructor(data: AggregationRow[]) {
        this.rawData = data || [];
    }

    /**
     * Get the raw data array.
     * @returns Array of aggregation result rows
     */
    public getData(): AggregationRow[] {
        return this.rawData;
    }

    /**
     * Get the number of rows in the aggregated results.
     */
    public get length(): number {
        return this.rawData.length;
    }

    /**
     * Get a specific row by index.
     * @param index - The row index
     * @returns The row at the specified index, or undefined if out of bounds
     */
    public getRow(index: number): AggregationRow | undefined {
        return this.rawData[index];
    }

    /**
     * Get a group field value from a specific row.
     * @param row - The aggregation row
     * @param groupField - The name of the group field
     * @returns The group field value
     */
    public getGroup(row: AggregationRow, groupField: string): any {
        return row[groupField];
    }

    /**
     * Get an aggregation value from a specific row.
     * Handles case-insensitive aggregation type matching.
     * @param row - The aggregation row
     * @param aggregationType - The aggregation type (case-insensitive: 'Count', 'Sum', 'Average', etc.)
     * @param aggregationField - The field that was aggregated
     * @returns The aggregation value
     */
    public getAggregation(row: AggregationRow, aggregationType: AggregationType | string, aggregationField: string): any {
        const fieldName = this.getAggregationFieldName(aggregationType, aggregationField);
        return row[fieldName];
    }

    /**
     * Build the aggregation field name from type and field.
     * @param aggregationType - The aggregation type (case-insensitive)
     * @param field - The field name
     * @returns The aggregation field name in the format {type}_{field}
     */
    private getAggregationFieldName(aggregationType: string, field: string): string {
        return `${aggregationType.toLowerCase()}_${field}`;
    }

    /**
     * Find rows matching specific group values.
     * @param groupFilters - Object with group field names as keys and desired values
     * @returns Array of matching rows
     * 
     * @example
     * // Find all rows where status is "Draft"
     * response.findByGroups({ status: 'Draft' })
     * 
     * @example
     * // Find rows where status is "Draft" and homeLanguage is "English"
     * response.findByGroups({ status: 'Draft', homeLanguage: 'English' })
     */
    public findByGroups(groupFilters: { [groupField: string]: any }): AggregationRow[] {
        return this.rawData.filter(row => {
            return Object.entries(groupFilters).every(([field, value]) => row[field] === value);
        });
    }

    /**
     * Get a specific aggregation value for rows matching group filters.
     * @param groupFilters - Object with group field names as keys and desired values
     * @param aggregationType - The aggregation type (case-insensitive)
     * @param aggregationField - The field that was aggregated
     * @returns The aggregation value from the first matching row, or undefined if no match
     * 
     * @example
     * // Get count of objKey for Draft status and English homeLanguage
     * response.getAggregationValue(
     *   { status: 'Draft', homeLanguage: 'English' },
     *   'Count',
     *   'objKey'
     * )
     */
    public getAggregationValue(
        groupFilters: { [groupField: string]: any },
        aggregationType: AggregationType | string,
        aggregationField: string
    ): any {
        const row = this.findByGroups(groupFilters)[0];
        return row ? this.getAggregation(row, aggregationType, aggregationField) : undefined;
    }

    /**
     * Iterate over all rows with a callback function.
     * @param callback - Function to execute for each row
     */
    public forEach(callback: (row: AggregationRow, index: number) => void): void {
        this.rawData.forEach(callback);
    }

    /**
     * Map aggregation rows to a new array.
     * @param callback - Function to transform each row
     * @returns New array of transformed values
     */
    public map<T>(callback: (row: AggregationRow, index: number) => T): T[] {
        return this.rawData.map(callback);
    }

    /**
     * Filter aggregation rows.
     * @param predicate - Function to test each row
     * @returns New array of rows that pass the test
     */
    public filter(predicate: (row: AggregationRow, index: number) => boolean): AggregationRow[] {
        return this.rawData.filter(predicate);
    }

    /**
     * Make the response iterable for use in for...of loops.
     */
    public [Symbol.iterator](): Iterator<AggregationRow> {
        return this.rawData[Symbol.iterator]();
    }

    /**
     * Get all unique values for a specific group field across all rows.
     * @param groupField - The group field name
     * @returns Array of unique values (excluding null/undefined)
     */
    public getUniqueGroupValues(groupField: string): any[] {
        const values = new Set<any>();
        this.rawData.forEach(row => {
            const value = row[groupField];
            if (value !== null && value !== undefined) {
                values.add(value);
            }
        });
        return Array.from(values);
    }

    /**
     * Calculate the sum of a specific aggregation across all rows.
     * Useful for totaling aggregated values.
     * @param aggregationType - The aggregation type
     * @param aggregationField - The field that was aggregated
     * @returns Sum of the aggregation values, or 0 if no valid values
     */
    public sumAggregation(aggregationType: AggregationType | string, aggregationField: string): number {
        const fieldName = this.getAggregationFieldName(aggregationType, aggregationField);
        return this.rawData.reduce((sum, row) => {
            const value = row[fieldName];
            return sum + (typeof value === 'number' ? value : 0);
        }, 0);
    }
}

// ================================================================================
// DATA AGGREGATION FUNCTIONS
// ================================================================================

/**
 * Performs data aggregation operations (count, sum, average, etc.) on grouped data.
 * Supports filtering, grouping with transforms, sorting, and multiple aggregations.
 *
 * @param request - Aggregation configuration including dataElementId, parent scope, groups, aggregations
 * @returns Promise<AggregationResponse> - A class instance providing structured access to aggregated data
 *
 * @example
 * const result = await getAggregateData({
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
 * 
 * // Access aggregation values
 * const count = result.getAggregationValue({ status: 'Draft' }, 'Count', 'objKey');
 * 
 * // Iterate over results
 * for (const row of result) {
 *   console.log(row.status, result.getAggregation(row, 'Sum', 'totalAmount'));
 * }
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

    return new AggregationResponse(response.data.data);
}

/**
 * Observable version of getAggregateData. See getAggregateData for details.
 *
 * @example
 * getAggregateDataAsObservable({
 *   dataElementId: 'order',
 *   groups: [{ groupField: 'status', groupDirection: 'asc' }],
 *   aggregations: [{ aggregation: 'Count', aggregationField: 'objKey' }]
 * }).subscribe(result => {
 *   console.log('Total rows:', result.length);
 *   result.forEach(row => console.log(result.getAggregation(row, 'Count', 'objKey')));
 * });
 */
export function getAggregateDataAsObservable(request: AggregationRequest): Observable<AggregationResponse> {
    return from(getAggregateData(request));
}

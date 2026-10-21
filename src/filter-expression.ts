// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * Halix data filter expression language string.
 *
 * This is not SQL, JavaScript, or an arbitrary query-string syntax. Use the
 * `build_filter_expression` agent tool to generate filter expressions for SDK
 * calls, list reads, aggregate queries, choosers, and generated TypeScript.
 *
 * Filter expressions are evaluated by Halix services within the request's
 * normal data-access scope. Most filter parameters must be less than 200
 * characters.
 *
 * @example
 * // Boolean comparison
 * const filter: FilterExpression = "archive!=boolean:true";
 *
 * @example
 * // Date and key comparisons
 * const filter: FilterExpression =
 *   "(endDate >= date:2025-06-12) AND (courseKey=string:crs~00~abc)";
 */
export type FilterExpression = string;

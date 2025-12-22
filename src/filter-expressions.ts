// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/filter-expressions
 * @description Filter expression language (dataexpr format) used throughout the SDK for filtering
 * data in queries.
 */

/**
 * FilterExpression represents a filter expression string in the Halix dataexpr format.
 * Used to filter data based on logical comparisons and boolean conditions.
 * 
 * ## Basic Forms
 * ```
 * <left> <operator> <right>
 * (<expression1>) AND (<expression2>)
 * (<expression1>) OR (<expression2>)
 * ```
 * Combine comparisons with AND/OR. Each operand must be in parentheses.
 * 
 * ## Supported Operators
 * 
 * | Operator | Description | Example |
 * |----------|-------------|---------|
 * | `=` | Equals | `status = 'active'` |
 * | `!=` | Not equals | `status != 'closed'` |
 * | `~` | Equals (case-insensitive) | `name ~ 'ADMIN'` |
 * | `!~` | Not equals (case-insensitive) | `role !~ 'ADMIN'` |
 * | `<` | Less than | `score < '80'` |
 * | `>` | Greater than | `score > '90'` |
 * | `<=` | Less than or equal to | `score <= '90'` |
 * | `>=` | Greater than or equal to | `score >= '70'` |
 * | `!>` | Begins with | `name !> 'Jo'` |
 * | `<!` | Ends with | `email <! '@example.com'` |
 * | `<>` | Contains (case-insensitive) | `notes <> 'important'` or `['A'] <> 'A'` |
 * | `!<>` | Does not contain (case-insensitive) | `tags !<> 'archived'` |
 * | `<empty> $void` | Value is empty | `notes <empty> $void` |
 * | `!<empty> $void` | Value is not empty | `notes !<empty> $void` |
 * 
 * ## Value Types
 * - **String literals**: `'value'` (single quotes required)
 * - **Attribute references**: `status`, `score` (no quotes)
 * - **Arrays**: `['A', 'B', 'C']`
 * - **Variables**: `$today`, `$daysAgo:5`
 * - **Page/group variables**: `'@{page.fieldName}'` (quoted)
 * 
 * ## Time Variables
 * - `$today`, `$todayTimestamp`, `$todayUnixTimestamp`
 * - `$startOfMonth`, `$endOfMonth`
 * - `$yearsAgo:N`, `$monthsAgo:N`, `$weeksAgo:N`, `$daysAgo:N`, `$hoursAgo:N`, `$minutesAgo:N`, `$secondsAgo:N`
 * - `$yearsAhead:N`, `$monthsAhead:N`, `$weeksAhead:N`, `$daysAhead:N`, `$hoursAhead:N`, `$minutesAhead:N`, `$secondsAhead:N`
 * 
 * ## Examples
 * ```typescript
 * // Simple comparison
 * "status = 'active'"
 * 
 * // Case-insensitive
 * "role ~ 'ADMIN'"
 * 
 * // Contains
 * "notes <> 'important'"
 * 
 * // Array contains
 * "['pending', 'active'] <> status"
 * 
 * // Not empty
 * "notes !<empty> $void"
 * 
 * // Compound with AND/OR
 * "(status = 'active') AND (priority = 'high')"
 * "(status = 'active') AND ((score > '90') OR (grade = 'A'))"
 * 
 * // Time-based
 * "createdAt > $daysAgo:30"
 * 
 * // Boolean
 * "enabled = boolean:true"
 * 
 * // Page variables
 * "category = '@{page.selectedCategory.value}'"
 * 
 * // Page variables with formatting (use generate_tokens tool)
 * "status = '@{page.filterInput.value | default:All}'"
 * ```
 * 
 * ## Notes
 * - **String literals** must be wrapped in single quotes: `'value'`
 * - **Attribute references** must not be quoted: `status`, `score`
 * - **Page/group variables** must be quoted: `'@{page.fieldName}'`, `'@{group.fieldName}'`
 * - The `<>` and `!<>` operators for contains/substring matching are case-insensitive
 * - Prefer case-insensitive equality checks (`~`, `!~`) over case-sensitive checks (`=`, `!=`) unless case-sensitivity is required
 * - Wildcard operators/pattern matching are NOT supported
 */
export type FilterExpression = string;


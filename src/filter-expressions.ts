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
 * 
 * Filter expressions are used to filter data based on logical comparisons and boolean conditions.
 * They support a wide range of operators, boolean logic, arrays, and special variables.
 * 
 * ## Expression Structure
 * 
 * An expression consists of:
 * - One or more comparisons
 * - Optionally combined using boolean operators (`AND`, `OR`)
 * - Grouped using parentheses `(...)` for logical grouping and precedence
 * 
 * ### Basic Forms
 * ```
 * <left> <operator> <right>
 * (<expression1>) AND (<expression2>)
 * (<expression1>) OR (<expression2>)
 * ```
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
 * | `<>` | Contains (string or array) | `tags <> 'urgent'` |
 * | `!<>` | Does not contain | `tags !<> 'archived'` |
 * | `<empty> $void` | Value is empty | `notes <empty> $void` |
 * | `!<empty> $void` | Value is not empty | `notes !<empty> $void` |
 * 
 * ## Value Types
 * 
 * Values in expressions can be:
 * - **String literals**: Must be wrapped in single quotes - `'value'`
 * - **Attribute references**: Must not be quoted - `status`, `score`
 * - **Arrays**: Literal arrays - `['A', 'B', 'C']`
 * - **Variables**: Special variables - `$today`, `$daysAgo:5`
 * - **Page/group variables**: Must be quoted - `'@{page.fieldName}'`, `'@{group.fieldName}'`
 * 
 * ## Boolean Logic
 * 
 * Combine comparisons using:
 * - `AND` – all subexpressions must be true
 * - `OR` – at least one subexpression must be true
 * 
 * **Important**: Each operand of `AND`/`OR` must be enclosed in parentheses.
 * 
 * ### Examples
 * ```
 * (status = 'active') AND (priority = 'high')
 * (status = 'active') AND ((priority = 'high') OR (escalated = 'true'))
 * ```
 * 
 * ## Expression Variables
 * 
 * Use special `$variables` for dynamic time-based filtering:
 * 
 * | Variable | Meaning |
 * |----------|---------|
 * | `$today` | Current date (e.g. `2023-06-25`) |
 * | `$todayTimestamp` | Timestamp for midnight today |
 * | `$todayUnixTimestamp` | Unix timestamp (ms) for today |
 * | `$startOfMonth` | First day of the current month |
 * | `$endOfMonth` | Last day of the current month |
 * | `$yearsAgo:N` | Timestamp N years ago |
 * | `$monthsAgo:N` | Timestamp N months ago |
 * | `$weeksAgo:N` | Timestamp N weeks ago |
 * | `$daysAgo:N` | Timestamp N days ago |
 * | `$hoursAgo:N` | Timestamp N hours ago |
 * | `$minutesAgo:N` | Timestamp N minutes ago |
 * | `$secondsAgo:N` | Timestamp N seconds ago |
 * | `$yearsAhead:N` | Timestamp N years in the future |
 * | `$monthsAhead:N` | Timestamp N months in the future |
 * | `$weeksAhead:N` | Timestamp N weeks in the future |
 * | `$daysAhead:N` | Timestamp N days in the future |
 * | `$hoursAhead:N` | Timestamp N hours in the future |
 * | `$minutesAhead:N` | Timestamp N minutes in the future |
 * | `$secondsAhead:N` | Timestamp N seconds in the future |
 * 
 * ## Common Examples
 * 
 * ### Simple Comparison
 * ```typescript
 * const filter = "status = 'active'";
 * ```
 * 
 * ### Case-Insensitive Match
 * ```typescript
 * const filter = "role ~ 'ADMIN'";
 * ```
 * 
 * ### Contains Check
 * ```typescript
 * const filter = "notes <> 'important'";
 * ```
 * 
 * ### Array Contains
 * ```typescript
 * const filter = "['pending', 'active', 'review'] <> status";
 * ```
 * 
 * ### Empty/Not Empty
 * ```typescript
 * const filter = "notes !<empty> $void";  // Has notes
 * ```
 * 
 * ### Compound Expression
 * ```typescript
 * const filter = "(status = 'active') AND (priority = 'high')";
 * ```
 * 
 * ### Nested Logic
 * ```typescript
 * const filter = "(status = 'active') AND ((score > '90') OR (grade = 'A'))";
 * ```
 * 
 * ### Time-Based Filtering
 * ```typescript
 * const filter = "createdAt > $daysAgo:30";  // Created in last 30 days
 * ```
 * 
 * ### Boolean Values
 * ```typescript
 * const filter = "enabled = boolean:true";
 * ```
 * 
 * ### Using Page Variables
 * ```typescript
 * const filter = "category = '@{page.selectedCategory.value}'";
 * ```
 * 
 * ### Complex Multi-Condition Filter
 * ```typescript
 * const filter = "(status = 'active') AND " +
 *                "((priority = 'high') OR (dueDate < $today)) AND " +
 *                "(assignedTo !<empty> $void)";
 * ```
 */
export type FilterExpression = string;


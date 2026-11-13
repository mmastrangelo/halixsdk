// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/pricing-action
 * @description Types for a pricing Action: the Action the platform calls to price shopping cart lines. A
 * purchasable object names its own pricing Action (its item action), and a solution may have one shared cart
 * pricing Action; both receive the same input and return the same shape.
 *
 * The platform calls a pricing Action on every pricing pass: when a line is added or changed, when the checkout
 * summary is built, and when the order is placed. It does not call the Action after the order.
 *
 * ```ts
 * export const handler = async (event: PricingActionEvent): Promise<PricingActionResponse> => {
 *   hx.initialize(event);
 *   const prices: Record<string, LinePrice> = {};
 *   for (const line of event.actionSubject) {
 *     const count = Number(line.cartItemFormData?.count ?? 0);
 *     prices[line.objKey] = { basePrice: count * 5, calcPrice: count * 5, applySalesTax: false };
 *   }
 *   return { responseType: 'singleValueAction', value: { prices } };
 * };
 * ```
 */

import type { IncomingEventBody } from './sdk-general';
import type { ShoppingCartItem } from './commerce';

/**
 * PricingActionParams is `event.params` of a pricing Action call.
 */
export interface PricingActionParams {
    /**
     * True on the pricing pass that places the order, and absent on every other pass. Payment follows in the same
     * request, and the platform does not call the Action again afterwards, whether the payment succeeds or fails.
     * An Action that holds reservations for a limited time makes them final on this pass. A platform that does not
     * mark the pass never sends the value, so an absent value means only that this is not known to be the order.
     */
    placingOrder?: boolean;
}

/**
 * PricingCartLine is one cart line as a pricing Action receives it in `event.actionSubject`.
 */
export interface PricingCartLine extends ShoppingCartItem {
    /**
     * State a pricing Action returned for this line on an earlier pass. Absent until an Action returns some.
     */
    actionData?: Record<string, any>;
    /** Plain-text lines supplied when the line was added. They stay ahead of the Action's `itemAdditionalInfo`. */
    displayInfo?: string[];
}

/**
 * PurchaseObject is a record the platform saves when the order is placed. A record without `objKey` is created;
 * a record with `objKey` replaces the stored record, so it carries the record's full values. The saves are undone
 * if the payment fails.
 */
export interface PurchaseObject {
    /** Storage type of the record. */
    objType: string;
    /** Key of an existing record to update. Omit it to create a record. */
    objKey?: string;
    /** Data element of a solution record. */
    dataElementId?: string;
    [attribute: string]: any;
}

/**
 * LinePrice is a pricing Action's result for one cart line.
 */
export interface LinePrice {
    /**
     * Price of one unit. Checkout charges `basePrice` times the line's `itemQuantity` for an object of a payable
     * data element.
     */
    basePrice: number;
    /** Line total the cart displays. Keep it equal to `basePrice` times the line's `itemQuantity`. */
    calcPrice: number;
    /** Whether the cart adds estimated sales tax to the line's display. */
    applySalesTax?: boolean;
    /** Replaces the line's name when not empty. */
    itemName?: string;
    /** Replaces the line's description when not empty. */
    itemDescription?: string;
    /** Plain-text lines the cart row and the receipt show after the line's own `displayInfo`. */
    itemAdditionalInfo?: string[];
    /** Records to save when the order is placed. The last pricing pass's list is the one saved. */
    saveOnPurchase?: PurchaseObject[];
    /**
     * State stored on the cart line and handed back on later passes as the line's `actionData`. Omit it to keep
     * the stored state; an empty object clears it. Its JSON is limited to 4000 bytes, and it reaches the browser.
     */
    actionData?: Record<string, any>;
}

/**
 * PricingActionValue is the `value` of a pricing Action's response.
 */
export interface PricingActionValue {
    /** Results by cart line key (`PricingCartLine.objKey`). */
    prices: Record<string, LinePrice>;
    /** When not empty, pricing fails with this message: the cart change or the order is refused. */
    validationError?: string;
}

/**
 * PricingActionEvent is the event a pricing Action's handler receives.
 */
export interface PricingActionEvent extends IncomingEventBody {
    actionSubject: PricingCartLine[];
    params: PricingActionParams;
}

/**
 * PricingActionResponse is the response a pricing Action returns.
 */
export interface PricingActionResponse {
    responseType: 'singleValueAction';
    value: PricingActionValue;
    successMessage?: string;
    isError?: boolean;
}

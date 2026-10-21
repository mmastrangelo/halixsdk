// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/commerce
 * @description Shopping cart functions for custom elements. Elements sell objects of payable data elements
 * (elements with `name` and a numeric `price`) by adding them to the platform shopping cart; the platform
 * checkout then prices the cart on the server and collects the payment. Payments are collected only through the
 * cart: there is no direct charge from custom element code.
 *
 * Typical flow:
 * 1. Call `initializeContext(context, hx)` from the custom element SDK so the SDK has the element's session.
 * 2. Call `addToCart({ dataElementId, objKey })` when the shopper chooses an object.
 * 3. Call `openCart(this.context.navigate)` to send the shopper to the platform cart and checkout.
 *
 * Every successful cart change dispatches a `halix:cart-changed` event on `document`, which keeps the shell's
 * cart icon in step with element code; `cartChanges()` observes the same events for elements that show a badge.
 *
 * A signed-in shopper uses the payer cart of the navigation's user proxy element. An anonymous shopper on a public
 * page uses the guest cart that the host page holds: the functions send its token instead of a session, and the
 * server allows a guest to add only objects whose `guestPurchaseAllowed` is true.
 */

import axios from 'axios';
import { from, lastValueFrom, Observable } from 'rxjs';
import { sandboxKey, serviceAddress, getAuthToken, getGuestCartHandle, userContext } from './sdk-general.js';

const CURRENT_CART_URL = 'ecommerce/sandboxes/:sandboxKey/organizations/:organizationKey/currentCart';
const ADD_ITEM_URL = 'ecommerce/sandboxes/:sandboxKey/shoppingCart/:shoppingCartKey/addItem';
const CART_ITEM_URL = 'ecommerce/sandboxes/:sandboxKey/shoppingCart/:shoppingCartKey/shoppingCartItem/:shoppingCartItemKey';
const GUEST_CART_TOKEN_HEADER = 'X-Halix-Cart-Token';
const GUEST_CART_ACCESS_DENIED = 'GuestCartAccessDenied';
const SHOPPING_CART_VALIDATION_ERROR = 'ShoppingCartValidationError';
const CART_CHANGED_EVENT = 'halix:cart-changed';
const CART_CHANGE_SOURCE = 'sdk';
const SHOPPING_CART_COMPONENT_ID = 'shoppingCart';

// ================================================================================
// INTERFACES
// ================================================================================

/**
 * ShoppingCart is the cart document returned by the cart routes.
 */
export interface ShoppingCart {
    /** Cart key; the `cartKey` of cart change events. */
    objKey: string;
    /** True for a guest cart, which has no payer until checkout. */
    guest?: boolean;
    payerKey?: string;
    payerElementID?: string;
    shoppingCartItemKeys?: string[];
    [key: string]: any;
}

/**
 * ShoppingCartItem is one line of a cart. Prices are set by the server from the object's `price` and the
 * sandbox pricing action; element code never supplies an amount.
 */
export interface ShoppingCartItem {
    /** Cart item key, used by `updateCartItemQuantity` and `removeFromCart`. */
    objKey: string;
    /** Storage type of the purchased object. */
    itemType: string;
    /** Key of the purchased object. */
    itemKey: string;
    itemQuantity: number;
    listPrice: number;
    basePrice: number;
    adjustedPrice: number;
    salesTax: number;
    calculatedPrice: number;
    cartItemFormData?: Record<string, unknown>;
    itemName?: string;
    itemDescription?: string;
    [key: string]: any;
}

/**
 * CartItem is a cart line with the purchased object's display data, as the cart list route returns it.
 */
export interface CartItem {
    shoppingCartItem: ShoppingCartItem;
    /** The purchased object. */
    purchaseableItem: Record<string, any>;
    name: string;
    description: string;
    /** Whether the line's quantity can be changed. */
    stackable: boolean;
    /** Resource key of the item's image. */
    image: string;
    [key: string]: any;
}

/**
 * Cart is the current shopper's cart with its items and totals. `itemCount` is the number of cart lines, the
 * count the shell's cart icon shows.
 */
export interface Cart {
    cart: ShoppingCart;
    items: CartItem[];
    itemCount: number;
    /** Sum of the items' calculated prices. */
    subTotal: number;
    /** Sum of the items' sales tax. */
    taxTotal: number;
    /** subTotal plus taxTotal. */
    total: number;
}

/**
 * AddToCartRequest identifies the object to add. The object must belong to a payable data element; the price
 * comes from the server.
 */
export interface AddToCartRequest {
    /** Data element ID of the object, e.g. 'eventTicket'. */
    dataElementId: string;
    /** Key of the object to add. */
    objKey: string;
    /** Whole number of units to add; defaults to 1. */
    quantity?: number;
    /** Optional cart item form data stored on the cart line. */
    formData?: Record<string, unknown>;
}

/**
 * CartChange is the detail of the `halix:cart-changed` event that the shell and custom elements dispatch on
 * `document` after a successful cart change.
 */
export interface CartChange {
    cartKey: string;
    itemCount: number;
    total: number;
    /** Who changed the cart: 'sdk' for this module, 'shell' or 'element' for the platform. */
    source: string;
}

/**
 * CommerceError carries the server's message for a refused cart request. A request the cart rejects, such as an
 * object that is not payable, disabled or outside its sale dates, has `errorCode` 'ShoppingCartValidationError'
 * and the server's reason as its message. A guest cart the server no longer accepts, because it expired or was
 * checked out, has `errorCode` 'GuestCartAccessDenied'.
 */
export class CommerceError extends Error {
    /** HTTP status when the failure came from an HTTP response. */
    readonly status?: number;
    /** Platform error code when supplied by the server. */
    readonly errorCode?: string;
    /** Raw error payload retained for diagnostics. */
    readonly response?: unknown;

    constructor(message: string, options?: { status?: number; errorCode?: string; response?: unknown; cause?: unknown }) {
        super(message);
        this.name = 'CommerceError';
        this.status = options?.status;
        this.errorCode = options?.errorCode;
        this.response = options?.response;
        if (options?.cause !== undefined) {
            Object.defineProperty(this, 'cause', {
                configurable: true,
                value: options.cause,
            });
        }
    }
}

// ================================================================================
// CART FUNCTIONS
// ================================================================================

/**
 * Returns the current shopper's cart with its items, item count and totals. A signed-in user's cart is the payer
 * cart for the navigation's user proxy element, created on first use; an anonymous shopper's is the host page's
 * guest cart.
 *
 * @returns Promise<Cart>
 * @throws CommerceError when the server refuses the request
 *
 * @example
 * const { items, total } = await hx.getCart();
 */
export async function getCart(): Promise<Cart> {
    const access = await cartAccess();
    const current = await loadCurrentCart(access);
    return toCart(current.cart, current.items);
}

/**
 * Observable version of getCart. See getCart for details.
 */
export function getCartAsObservable(): Observable<Cart> {
    return from(getCart());
}

/**
 * Adds an object of a payable data element to the current shopper's cart and returns the cart's items. The
 * server prices the line and rejects an object whose element is not payable, that is disabled, or that is outside
 * its open and close dates, and for a guest any object whose `guestPurchaseAllowed` is not true; the thrown
 * CommerceError carries the server's reason. A successful add dispatches `halix:cart-changed`.
 *
 * @param request - The object to add, the quantity (default 1) and optional form data
 * @returns Promise<CartItem[]> - the cart's items after the add
 * @throws CommerceError when the server rejects the add
 *
 * @example
 * try {
 *     await hx.addToCart({ dataElementId: 'eventTicket', objKey: ticket.objKey });
 * } catch (error) {
 *     this.errorMessage = error.message;
 * }
 */
export async function addToCart(request: AddToCartRequest): Promise<CartItem[]> {
    const { dataElementId, objKey, quantity = 1, formData } = request ?? ({} as AddToCartRequest);
    if (!dataElementId || !objKey) {
        throw new Error('addToCart requires dataElementId and objKey.');
    }
    assertQuantity(quantity);

    const access = await cartAccess();
    const current = await loadCurrentCart(access);
    const cartKey = current.cart.objKey;
    const url = cartUrl(ADD_ITEM_URL, { shoppingCartKey: cartKey });
    const items = await send<CartItem[]>(access, () => axios.post(url, {
        itemElementId: dataElementId,
        itemKey: objKey,
        quantity,
        formData,
    }, { headers: access.headers }));

    dispatchCartChanged(cartKey, items);
    return items;
}

/**
 * Observable version of addToCart. See addToCart for details.
 */
export function addToCartAsObservable(request: AddToCartRequest): Observable<CartItem[]> {
    return from(addToCart(request));
}

/**
 * Sets the quantity of a line in the current shopper's cart and returns the cart's items. A successful change
 * dispatches `halix:cart-changed`.
 *
 * @param cartItemKey - The cart item key (`items[i].shoppingCartItem.objKey`)
 * @param quantity - The new whole-number quantity, at least 1; use removeFromCart to remove a line
 * @returns Promise<CartItem[]> - the cart's items after the change
 * @throws CommerceError when the server rejects the change
 */
export async function updateCartItemQuantity(cartItemKey: string, quantity: number): Promise<CartItem[]> {
    if (!cartItemKey) {
        throw new Error('updateCartItemQuantity requires a cart item key.');
    }
    assertQuantity(quantity);

    const access = await cartAccess();
    const current = await loadCurrentCart(access);
    const cartKey = current.cart.objKey;
    const url = cartUrl(CART_ITEM_URL, { shoppingCartKey: cartKey, shoppingCartItemKey: cartItemKey });
    const items = await send<CartItem[]>(access, () => axios.get(url, {
        headers: access.headers,
        params: { quantity },
    }));

    dispatchCartChanged(cartKey, items);
    return items;
}

/**
 * Observable version of updateCartItemQuantity. See updateCartItemQuantity for details.
 */
export function updateCartItemQuantityAsObservable(cartItemKey: string, quantity: number): Observable<CartItem[]> {
    return from(updateCartItemQuantity(cartItemKey, quantity));
}

/**
 * Removes a line from the current shopper's cart and returns the cart's remaining items. A successful removal
 * dispatches `halix:cart-changed`.
 *
 * @param cartItemKey - The cart item key (`items[i].shoppingCartItem.objKey`)
 * @returns Promise<CartItem[]> - the cart's items after the removal
 * @throws CommerceError when the server rejects the removal
 */
export async function removeFromCart(cartItemKey: string): Promise<CartItem[]> {
    if (!cartItemKey) {
        throw new Error('removeFromCart requires a cart item key.');
    }

    const access = await cartAccess();
    const current = await loadCurrentCart(access);
    const cartKey = current.cart.objKey;
    const url = cartUrl(CART_ITEM_URL, { shoppingCartKey: cartKey, shoppingCartItemKey: cartItemKey });
    const items = await send<CartItem[]>(access, () => axios.delete(url, { headers: access.headers }));

    dispatchCartChanged(cartKey, items);
    return items;
}

/**
 * Observable version of removeFromCart. See removeFromCart for details.
 */
export function removeFromCartAsObservable(cartItemKey: string): Observable<CartItem[]> {
    return from(removeFromCart(cartItemKey));
}

/**
 * Navigates to the solution's shopping cart, where the platform checkout collects the payment. Pass the
 * custom element context's navigate function.
 *
 * @param navigate - The custom element context's navigate function
 * @returns Promise<void> - resolves when the navigation completes
 *
 * @example
 * await hx.openCart(this.context.navigate);
 */
export async function openCart(navigate: (componentId: string, queryParams?: { [key: string]: string }) => Observable<unknown>): Promise<void> {
    if (typeof navigate !== 'function') {
        throw new Error('openCart requires the custom element context navigate function: hx.openCart(this.context.navigate).');
    }
    await lastValueFrom(navigate(SHOPPING_CART_COMPONENT_ID), { defaultValue: undefined });
}

/**
 * Observes `halix:cart-changed` events, whether the change came from this SDK, another element or the shell.
 * Use it to keep a cart badge current. Outside a browser it completes without emitting.
 *
 * @returns Observable<CartChange>
 *
 * @example
 * this.subscription = hx.cartChanges().subscribe(change => this.count = change.itemCount);
 */
export function cartChanges(): Observable<CartChange> {
    return new Observable<CartChange>(subscriber => {
        if (typeof document === 'undefined') {
            subscriber.complete();
            return;
        }
        const listener = (event: Event) => {
            const detail = (event as CustomEvent<CartChange>).detail;
            if (detail) {
                subscriber.next(detail);
            }
        };
        document.addEventListener(CART_CHANGED_EVENT, listener);
        return () => document.removeEventListener(CART_CHANGED_EVENT, listener);
    });
}

// ================================================================================
// INTERNALS
// ================================================================================

interface CartAccess {
    headers: Record<string, string>;
    /** The signed-in payer element; a guest has none because the token names the cart. */
    payerElementId?: string;
    guest: boolean;
}

interface CurrentCartResponse {
    cart: ShoppingCart;
    items: CartItem[];
}

// An undefined token means an anonymous shopper: the guest cart token replaces the session, so no
// Authorization header is sent.
async function cartAccess(): Promise<CartAccess> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    const authToken = await lastValueFrom(getAuthToken(), { defaultValue: undefined });
    if (authToken) {
        const payerElementId = userContext?.navigationContext?.userProxyElementId;
        if (!payerElementId) {
            throw new Error('userContext.navigationContext.userProxyElementId is required for the shopping cart; the current navigation has no user proxy element.');
        }
        return { headers: { Authorization: `Bearer ${authToken}` }, payerElementId, guest: false };
    }

    const handle = getGuestCartHandle();
    if (!handle?.cartToken) {
        throw new Error('The shopper is not signed in and has no guest cart. Guest checkout is available only on a public page that holds a guest cart; otherwise the shopper must sign in.');
    }
    return { headers: { [GUEST_CART_TOKEN_HEADER]: handle.cartToken }, guest: true };
}

async function loadCurrentCart(access: CartAccess): Promise<CurrentCartResponse> {
    const organizationKey = userContext?.orgKey;
    if (!organizationKey) {
        throw new Error('userContext.orgKey is required for the shopping cart; check that initialize has been called with a full userContext.');
    }

    const url = cartUrl(CURRENT_CART_URL, { organizationKey });
    const current = await send<CurrentCartResponse>(access, () => axios.get(url, {
        headers: access.headers,
        params: access.payerElementId ? { payerElementId: access.payerElementId } : undefined,
    }));
    if (!current?.cart?.objKey) {
        throw new CommerceError('The current cart could not be resolved.', { response: current });
    }
    return current;
}

async function send<T>(access: CartAccess, request: () => Promise<{ data: T }>): Promise<T> {
    try {
        const response = await request();
        return response.data;
    } catch (error) {
        throw toCommerceError(error, access.guest);
    }
}

function toCommerceError(error: unknown, guest: boolean): CommerceError {
    const axiosError = error as {
        message?: string;
        response?: {
            status?: number;
            data?: { message?: string; errorMessage?: string; errorCode?: string; code?: string };
        };
    };
    const status = axiosError?.response?.status;
    const body = axiosError?.response?.data;
    const message = body?.message ?? body?.errorMessage ?? axiosError?.message ?? 'The cart request failed.';
    const errorCode = body?.errorCode ?? body?.code;

    if (guest && guestCartRefused(status, errorCode, body?.message)) {
        return new CommerceError(
            `The guest cart is no longer available; it may have expired or been checked out. (${message})`,
            { status, errorCode: GUEST_CART_ACCESS_DENIED, response: body, cause: error },
        );
    }
    return new CommerceError(message, { status, errorCode, response: body, cause: error });
}

// The same refusal test as the shell's guest cart handle: the access rule's 400 or the guest cart 403, never a
// validation error.
function guestCartRefused(status: number | undefined, errorCode: string | undefined, message: string | undefined): boolean {
    if (errorCode === SHOPPING_CART_VALIDATION_ERROR) {
        return false;
    }
    return (status === 403 && errorCode === GUEST_CART_ACCESS_DENIED) ||
        (status === 400 && typeof message === 'string' && message.startsWith('API access denied'));
}

function cartUrl(template: string, pathParams: Record<string, string>): string {
    let path = template.replace(':sandboxKey', encodeURIComponent(sandboxKey));
    for (const name of Object.keys(pathParams)) {
        path = path.replace(`:${name}`, encodeURIComponent(pathParams[name]));
    }
    return `${serviceAddress}/${path}`;
}

function assertQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error('Quantity must be a whole number greater than zero.');
    }
}

function cartTotals(items: CartItem[]): { subTotal: number; taxTotal: number; total: number } {
    const subTotal = (items || []).reduce((total, item) => total + (item.shoppingCartItem?.calculatedPrice || 0), 0);
    const taxTotal = (items || []).reduce((total, item) => total + (item.shoppingCartItem?.salesTax || 0), 0);
    return { subTotal, taxTotal, total: subTotal + taxTotal };
}

function toCart(cart: ShoppingCart, items: CartItem[]): Cart {
    const cartItems = items || [];
    return { cart, items: cartItems, itemCount: cartItems.length, ...cartTotals(cartItems) };
}

// The detail matches the shell's cart-changed contract, so the shell's cart icon refreshes after SDK changes.
function dispatchCartChanged(cartKey: string, items: CartItem[]): void {
    if (typeof document === 'undefined' || typeof CustomEvent === 'undefined') {
        return;
    }
    const detail: CartChange = {
        cartKey,
        itemCount: items?.length || 0,
        total: cartTotals(items).total,
        source: CART_CHANGE_SOURCE,
    };
    document.dispatchEvent(new CustomEvent<CartChange>(CART_CHANGED_EVENT, { detail }));
}

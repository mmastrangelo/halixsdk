import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { lastValueFrom, of } from 'rxjs';
import {
    initialize,
    getCart,
    getCartAsObservable,
    addToCart,
    updateCartItemQuantity,
    removeFromCart,
    openCart,
    cartChanges,
    CommerceError,
    type CartChange,
} from '../src/index';

vi.mock('axios', () => {
    return {
        default: {
            get: vi.fn(),
            post: vi.fn(),
            delete: vi.fn(),
        },
    } as any;
});

const mockedAxios = axios as unknown as {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
};

const CURRENT_CART_URL = 'https://svc/ecommerce/sandboxes/sb/organizations/org1/currentCart';

const cart = { objKey: 'cart1', payerKey: 'payer1', payerElementID: 'member' };

function item(objKey: string, calculatedPrice: number, salesTax = 0) {
    return {
        shoppingCartItem: { objKey, itemType: 'EventTicket', itemKey: `${objKey}-obj`, itemQuantity: 1, calculatedPrice, salesTax },
        purchaseableItem: {},
        name: objKey,
        description: '',
        stackable: true,
        image: '',
    };
}

function initializeSignedIn(overrides: Record<string, any> = {}) {
    initialize({
        sandboxKey: 'sb',
        serviceAddress: 'https://svc',
        actionSubject: {},
        userContext: {
            user: { objKey: 'user1' },
            userProxy: {},
            orgProxy: {},
            orgProxyKey: 'orgProxy1',
            orgKey: 'org1',
            userProxyKey: 'userProxy1',
            navigationContext: {
                navigationKey: 'nav1',
                navLevel: 'user',
                userProxyElementId: 'member',
                orgProxyElementId: 'club',
                userProxyRequired: true,
            },
        },
        params: {},
        authTokenRetriever: () => of('TOKEN'),
        ...overrides,
    } as any);
}

function validationError(message: string) {
    return Object.assign(new Error('Request failed with status code 400'), {
        isAxiosError: true,
        response: {
            status: 400,
            data: { objType: 'Error', status: 400, errorCode: 'ShoppingCartValidationError', message, details: null },
        },
    });
}

let cartEvents: CartChange[];

beforeEach(() => {
    // Reset rather than clear so a response queued by a failing test never reaches the next one.
    vi.resetAllMocks();
    vi.stubGlobal('document', new EventTarget());
    cartEvents = [];
    document.addEventListener('halix:cart-changed', event => cartEvents.push((event as CustomEvent<CartChange>).detail));
    initializeSignedIn();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('getCart / getCartAsObservable', () => {
    it('loads the signed-in payer cart for the navigation user proxy element and computes totals', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { cart, items: [item('i1', 10, 0.5), item('i2', 5)] } });

        const result = await getCart();

        const [url, config] = mockedAxios.get.mock.calls[0];
        expect(url).toBe(CURRENT_CART_URL);
        expect(config.params).toEqual({ payerElementId: 'member' });
        expect(config.headers).toEqual({ Authorization: 'Bearer TOKEN' });
        expect(result.cart.objKey).toBe('cart1');
        expect(result.itemCount).toBe(2);
        expect(result.subTotal).toBe(15);
        expect(result.taxTotal).toBe(0.5);
        expect(result.total).toBe(15.5);
        expect(cartEvents).toEqual([]);
    });

    it('observable wrapper resolves the same cart', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { cart, items: [] } });

        const result = await lastValueFrom(getCartAsObservable());

        expect(result.itemCount).toBe(0);
        expect(result.total).toBe(0);
    });

    it('requires the navigation user proxy element for a signed-in user', async () => {
        initializeSignedIn({
            userContext: { orgKey: 'org1', navigationContext: { navigationKey: 'nav1' } },
        });

        await expect(getCart()).rejects.toThrow('userProxyElementId is required');
        expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('requires the organization key', async () => {
        initializeSignedIn({
            userContext: { navigationContext: { navigationKey: 'nav1', userProxyElementId: 'member' } },
        });

        await expect(getCart()).rejects.toThrow('userContext.orgKey is required');
        expect(mockedAxios.get).not.toHaveBeenCalled();
    });
});

describe('addToCart', () => {
    it('resolves the current cart, posts the element and object, and dispatches the cart change', async () => {
        const items = [item('i1', 20, 1)];
        mockedAxios.get.mockResolvedValueOnce({ data: { cart, items: [] } });
        mockedAxios.post.mockResolvedValueOnce({ data: items });

        const result = await addToCart({ dataElementId: 'eventTicket', objKey: 'ticket1', formData: { seat: 'A1' } });

        expect(mockedAxios.get.mock.calls[0][0]).toBe(CURRENT_CART_URL);
        const [url, body, config] = mockedAxios.post.mock.calls[0];
        expect(url).toBe('https://svc/ecommerce/sandboxes/sb/shoppingCart/cart1/addItem');
        expect(body).toEqual({ itemElementId: 'eventTicket', itemKey: 'ticket1', quantity: 1, formData: { seat: 'A1' } });
        expect(config.headers).toEqual({ Authorization: 'Bearer TOKEN' });
        expect(result).toBe(items);
        expect(cartEvents).toEqual([{ cartKey: 'cart1', itemCount: 1, total: 21, source: 'sdk' }]);
    });

    it('sends an explicit quantity', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { cart, items: [] } });
        mockedAxios.post.mockResolvedValueOnce({ data: [] });

        await addToCart({ dataElementId: 'eventTicket', objKey: 'ticket1', quantity: 3 });

        expect(mockedAxios.post.mock.calls[0][1].quantity).toBe(3);
    });

    it('preserves the server validation message and does not dispatch a cart change', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { cart, items: [] } });
        mockedAxios.post.mockRejectedValueOnce(validationError('Early Bird Ticket is no longer available for purchase'));

        const error = await addToCart({ dataElementId: 'eventTicket', objKey: 'ticket1' }).catch(e => e);

        expect(error).toBeInstanceOf(CommerceError);
        expect(error.message).toBe('Early Bird Ticket is no longer available for purchase');
        expect(error.errorCode).toBe('ShoppingCartValidationError');
        expect(error.status).toBe(400);
        expect(cartEvents).toEqual([]);
    });

    it('does not dispatch a cart change when the current cart cannot be loaded', async () => {
        mockedAxios.get.mockRejectedValueOnce(Object.assign(new Error('Request failed'), {
            response: { status: 400, data: { status: 400, message: 'payerElementId is required' } },
        }));

        await expect(addToCart({ dataElementId: 'eventTicket', objKey: 'ticket1' })).rejects.toThrow('payerElementId is required');
        expect(mockedAxios.post).not.toHaveBeenCalled();
        expect(cartEvents).toEqual([]);
    });

    it('rejects a missing object or an invalid quantity before calling the server', async () => {
        await expect(addToCart({ dataElementId: 'eventTicket', objKey: '' })).rejects.toThrow('dataElementId and objKey');
        await expect(addToCart({ dataElementId: 'eventTicket', objKey: 'ticket1', quantity: 0 })).rejects.toThrow('whole number');
        await expect(addToCart({ dataElementId: 'eventTicket', objKey: 'ticket1', quantity: 1.5 })).rejects.toThrow('whole number');
        expect(mockedAxios.get).not.toHaveBeenCalled();
        expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('uses the signed-in session even when a guest handle is present', async () => {
        initializeSignedIn({ guestCartHandle: { cartKey: 'guestCart', cartToken: 'GUEST' } });
        mockedAxios.get.mockResolvedValueOnce({ data: { cart, items: [] } });
        mockedAxios.post.mockResolvedValueOnce({ data: [] });

        await addToCart({ dataElementId: 'eventTicket', objKey: 'ticket1' });

        expect(mockedAxios.get.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer TOKEN' });
        expect(mockedAxios.get.mock.calls[0][1].params).toEqual({ payerElementId: 'member' });
        expect(mockedAxios.post.mock.calls[0][2].headers).toEqual({ Authorization: 'Bearer TOKEN' });
    });
});

describe('guest cart', () => {
    const guestCart = { objKey: 'guestCart', guest: true };
    const guestHeaders = { 'X-Halix-Cart-Token': 'GUEST' };

    function initializeGuest(body: Record<string, any> = { guestCartHandle: { cartKey: 'guestCart', cartToken: 'GUEST' } }) {
        initializeSignedIn({
            userContext: {
                user: undefined,
                orgKey: 'org1',
                navigationContext: { navigationKey: 'publicNav', navLevel: 'organization', userProxyElementId: 'member' },
            },
            authTokenRetriever: () => of(undefined),
            ...body,
        });
    }

    function refusal(status: number, data: Record<string, any>) {
        return Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });
    }

    it('loads the guest cart with the cart token, no Authorization header and no payer element', async () => {
        initializeGuest();
        mockedAxios.get.mockResolvedValueOnce({ data: { cart: guestCart, items: [item('i1', 8)] } });

        const result = await getCart();

        const [url, config] = mockedAxios.get.mock.calls[0];
        expect(url).toBe(CURRENT_CART_URL);
        expect(config.headers).toEqual(guestHeaders);
        expect(config.params).toBeUndefined();
        expect(result.cart.guest).toBe(true);
        expect(result.total).toBe(8);
    });

    it('adds to the guest cart with the cart token on every request and dispatches the cart change', async () => {
        initializeGuest();
        mockedAxios.get.mockResolvedValueOnce({ data: { cart: guestCart, items: [] } });
        mockedAxios.post.mockResolvedValueOnce({ data: [item('i1', 12, 0.6)] });

        await addToCart({ dataElementId: 'eventTicket', objKey: 'ticket1' });

        expect(mockedAxios.get.mock.calls[0][1].headers).toEqual(guestHeaders);
        const [url, body, config] = mockedAxios.post.mock.calls[0];
        expect(url).toBe('https://svc/ecommerce/sandboxes/sb/shoppingCart/guestCart/addItem');
        expect(body).toEqual({ itemElementId: 'eventTicket', itemKey: 'ticket1', quantity: 1, formData: undefined });
        expect(config.headers).toEqual(guestHeaders);
        expect(cartEvents).toEqual([{ cartKey: 'guestCart', itemCount: 1, total: 12.6, source: 'sdk' }]);
    });

    it('sends the cart token on quantity updates and removals', async () => {
        initializeGuest();
        mockedAxios.get
            .mockResolvedValueOnce({ data: { cart: guestCart, items: [item('i1', 5)] } })
            .mockResolvedValueOnce({ data: [item('i1', 10)] })
            .mockResolvedValueOnce({ data: { cart: guestCart, items: [item('i1', 10)] } });
        mockedAxios.delete.mockResolvedValueOnce({ data: [] });

        await updateCartItemQuantity('i1', 2);
        await removeFromCart('i1');

        expect(mockedAxios.get.mock.calls[1][1]).toEqual({ headers: guestHeaders, params: { quantity: 2 } });
        expect(mockedAxios.delete.mock.calls[0][1]).toEqual({ headers: guestHeaders });
        expect(cartEvents.map(change => change.itemCount)).toEqual([1, 0]);
    });

    it('reads a handle the host creates after initialization', async () => {
        let handle: { cartKey: string; cartToken: string } | undefined;
        // Defined on the body itself: spreading an object with a getter would copy its current value.
        const body: Record<string, any> = {
            sandboxKey: 'sb',
            serviceAddress: 'https://svc',
            actionSubject: {},
            userContext: { orgKey: 'org1', navigationContext: { navigationKey: 'publicNav', userProxyElementId: 'member' } },
            params: {},
            authTokenRetriever: () => of(undefined),
        };
        Object.defineProperty(body, 'guestCartHandle', { get: () => handle, enumerable: true });
        initialize({ body } as any);

        await expect(getCart()).rejects.toThrow('Guest checkout');

        handle = { cartKey: 'guestCart', cartToken: 'LATER' };
        mockedAxios.get.mockResolvedValueOnce({ data: { cart: guestCart, items: [] } });
        await getCart();

        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(mockedAxios.get.mock.calls[0][1].headers).toEqual({ 'X-Halix-Cart-Token': 'LATER' });
    });

    it('throws an error naming guest checkout when there is neither a token nor a handle', async () => {
        initializeGuest({});

        await expect(addToCart({ dataElementId: 'eventTicket', objKey: 'ticket1' })).rejects.toThrow('Guest checkout is available only on a public page');
        expect(mockedAxios.get).not.toHaveBeenCalled();
        expect(cartEvents).toEqual([]);
    });

    it('does not keep a handle from an earlier initialization', async () => {
        initializeGuest();
        initializeGuest({});

        await expect(getCart()).rejects.toThrow('not signed in');
        expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('reports a guest cart the server refuses with GuestCartAccessDenied', async () => {
        initializeGuest();
        mockedAxios.get.mockRejectedValueOnce(refusal(403, { status: 403, errorCode: 'GuestCartAccessDenied', message: 'guest cart token is invalid' }));

        const error = await addToCart({ dataElementId: 'eventTicket', objKey: 'ticket1' }).catch(e => e);

        expect(error).toBeInstanceOf(CommerceError);
        expect(error.errorCode).toBe('GuestCartAccessDenied');
        expect(error.status).toBe(403);
        expect(error.message).toContain('guest cart is no longer available');
        expect(error.message).toContain('guest cart token is invalid');
        expect(mockedAxios.post).not.toHaveBeenCalled();
        expect(cartEvents).toEqual([]);
    });

    it('reports the access rule refusal of a guest cart with the same error code', async () => {
        initializeGuest();
        mockedAxios.get.mockResolvedValueOnce({ data: { cart: guestCart, items: [] } });
        mockedAxios.post.mockRejectedValueOnce(refusal(400, { status: 400, message: 'API access denied; reasons: [shopping cart access]' }));

        const error = await addToCart({ dataElementId: 'eventTicket', objKey: 'ticket1' }).catch(e => e);

        expect(error.errorCode).toBe('GuestCartAccessDenied');
        expect(error.status).toBe(400);
        expect(cartEvents).toEqual([]);
    });

    it('preserves the server message when a guest may not buy the object', async () => {
        initializeGuest();
        mockedAxios.get.mockResolvedValueOnce({ data: { cart: guestCart, items: [] } });
        mockedAxios.post.mockRejectedValueOnce(validationError('Member Dues cannot be purchased by a guest'));

        const error = await addToCart({ dataElementId: 'dues', objKey: 'dues1' }).catch(e => e);

        expect(error.errorCode).toBe('ShoppingCartValidationError');
        expect(error.message).toBe('Member Dues cannot be purchased by a guest');
        expect(cartEvents).toEqual([]);
    });

    it('leaves a signed-in API access refusal unchanged', async () => {
        mockedAxios.get.mockRejectedValueOnce(refusal(400, { status: 400, message: 'API access denied; reasons: [scope]' }));

        const error = await getCart().catch(e => e);

        expect(error.errorCode).toBeUndefined();
        expect(error.message).toBe('API access denied; reasons: [scope]');
    });
});

describe('updateCartItemQuantity / removeFromCart', () => {
    it('updates the quantity through the cart item route and dispatches the cart change', async () => {
        const items = [item('i1', 30)];
        mockedAxios.get
            .mockResolvedValueOnce({ data: { cart, items: [item('i1', 10)] } })
            .mockResolvedValueOnce({ data: items });

        const result = await updateCartItemQuantity('i1', 3);

        const [url, config] = mockedAxios.get.mock.calls[1];
        expect(url).toBe('https://svc/ecommerce/sandboxes/sb/shoppingCart/cart1/shoppingCartItem/i1');
        expect(config.params).toEqual({ quantity: 3 });
        expect(config.headers).toEqual({ Authorization: 'Bearer TOKEN' });
        expect(result).toBe(items);
        expect(cartEvents).toEqual([{ cartKey: 'cart1', itemCount: 1, total: 30, source: 'sdk' }]);
    });

    it('rejects a quantity below one', async () => {
        await expect(updateCartItemQuantity('i1', 0)).rejects.toThrow('whole number');
        expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('removes the line through the cart item route and dispatches the cart change', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { cart, items: [item('i1', 10), item('i2', 5)] } });
        mockedAxios.delete.mockResolvedValueOnce({ data: [item('i2', 5)] });

        const result = await removeFromCart('i1');

        const [url, config] = mockedAxios.delete.mock.calls[0];
        expect(url).toBe('https://svc/ecommerce/sandboxes/sb/shoppingCart/cart1/shoppingCartItem/i1');
        expect(config.headers).toEqual({ Authorization: 'Bearer TOKEN' });
        expect(result).toHaveLength(1);
        expect(cartEvents).toEqual([{ cartKey: 'cart1', itemCount: 1, total: 5, source: 'sdk' }]);
    });

    it('preserves the server message when a removal fails and does not dispatch', async () => {
        mockedAxios.get.mockResolvedValueOnce({ data: { cart, items: [] } });
        mockedAxios.delete.mockRejectedValueOnce(validationError('item not found in cart'));

        await expect(removeFromCart('missing')).rejects.toThrow('item not found in cart');
        expect(cartEvents).toEqual([]);
    });
});

describe('openCart', () => {
    it('navigates to the shoppingCart component through the context navigate function', async () => {
        const navigate = vi.fn(() => of(true));

        await openCart(navigate);

        expect(navigate).toHaveBeenCalledWith('shoppingCart');
    });

    it('resolves when navigate completes without emitting', async () => {
        await expect(openCart(() => of())).resolves.toBeUndefined();
    });

    it('requires a navigate function', async () => {
        await expect(openCart(undefined as any)).rejects.toThrow('this.context.navigate');
    });
});

describe('cartChanges', () => {
    it('emits cart change details from the SDK, other elements and the shell until unsubscribed', () => {
        const received: CartChange[] = [];
        const subscription = cartChanges().subscribe(change => received.push(change));
        const shellChange = { cartKey: 'cart1', itemCount: 2, total: 12, source: 'shell' };

        document.dispatchEvent(new CustomEvent('halix:cart-changed', { detail: shellChange }));
        subscription.unsubscribe();
        document.dispatchEvent(new CustomEvent('halix:cart-changed', { detail: { ...shellChange, itemCount: 3 } }));

        expect(received).toEqual([shellChange]);
    });

    it('completes without emitting outside a browser', async () => {
        vi.unstubAllGlobals();

        await expect(lastValueFrom(cartChanges(), { defaultValue: 'none' })).resolves.toBe('none');
    });
});

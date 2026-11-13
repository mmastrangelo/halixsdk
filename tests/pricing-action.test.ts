import { describe, it, expect } from 'vitest';
import * as hx from '../src/index';
import type {
    LinePrice,
    PricingActionEvent,
    PricingActionResponse,
    SingleValueActionResponse,
} from '../src/index';

// The pricing Action types have no runtime code. This file writes the documented handler against them and
// runs it. `npm run test:types` compiles this file, so the handler, its call to `initialize`, and the
// `@ts-expect-error` lines below are type-checked; the test runner alone does not type-check.

const handler = async (event: PricingActionEvent) => {
    hx.initialize(event);
    const prices: Record<string, LinePrice> = {};
    for (const line of event.actionSubject) {
        const count = Number(line.cartItemFormData?.count ?? 0);
        const held: number[] = line.actionData?.held ?? [];
        prices[line.objKey] = {
            basePrice: count * 5,
            calcPrice: count * 5 * line.itemQuantity,
            applySalesTax: false,
            itemAdditionalInfo: [event.params.placingOrder ? 'final' : 'held'],
            actionData: { held },
            saveOnPurchase: held.map(number => ({ objType: 'SolutionObject', dataElementId: 'ticket', number })),
        };
    }
    const response: PricingActionResponse = {
        responseType: 'singleValueAction',
        isError: false,
        successMessage: '',
        value: { prices },
    };
    return hx.prepareSuccessResponse(response);
};

function event(overrides: Partial<PricingActionEvent>): PricingActionEvent {
    return {
        sandboxKey: 'sbx',
        serviceAddress: 'https://example.invalid',
        authToken: 'token',
        userContext: { userProxyKey: 'payer-1', orgProxyKey: 'org-proxy', orgKey: 'org' } as PricingActionEvent['userContext'],
        actionSubject: [],
        params: {},
        ...overrides,
    };
}

const line = {
    objKey: 'line-1',
    itemType: 'SolutionObject',
    itemKey: 'fee-1',
    itemQuantity: 1,
    listPrice: 0,
    basePrice: 0,
    adjustedPrice: 0,
    salesTax: 0,
    calculatedPrice: 0,
    cartItemFormData: { count: 2 },
    actionData: { held: [101, 102] },
};

async function price(incoming: PricingActionEvent) {
    const response = await handler(incoming) as SingleValueActionResponse;
    return (response as PricingActionResponse).value.prices;
}

describe('pricing Action types', () => {
    it('describe an ordinary pricing pass', async () => {
        const prices = await price(event({ actionSubject: [line] }));

        expect(prices['line-1']).toMatchObject({
            basePrice: 10,
            calcPrice: 10,
            itemAdditionalInfo: ['held'],
            actionData: { held: [101, 102] },
        });
        expect(prices['line-1'].saveOnPurchase).toHaveLength(2);
    });

    it('describe the pass that places the order', async () => {
        const prices = await price(event({ actionSubject: [line], params: { placingOrder: true } }));

        expect(prices['line-1'].itemAdditionalInfo).toEqual(['final']);
    });

    it('reject a misspelled order flag and a misspelled price field', () => {
        const incoming = event({});

        // @ts-expect-error the flag is placingOrder
        expect(incoming.params.placingorder).toBeUndefined();

        // @ts-expect-error the field is calcPrice
        const entry: LinePrice = { basePrice: 1, calculatedPrice: 1 };
        expect(entry.basePrice).toBe(1);
    });
});

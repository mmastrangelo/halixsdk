import { describe, it, expect } from 'vitest';
import type {
    LinePrice,
    PricingActionEvent,
    PricingActionResponse,
    PricingActionValue,
} from '../src/index';

// The pricing Action types have no runtime code. These tests write a handler against them and run it, so
// the example in the module documentation stays honest. The test runner does not type-check: the
// `@ts-expect-error` lines hold only when this file is compiled with tsc.

function event(overrides: Partial<PricingActionEvent>): PricingActionEvent {
    return {
        sandboxKey: 'sbx',
        serviceAddress: 'https://example.invalid',
        userContext: {} as PricingActionEvent['userContext'],
        actionSubject: [],
        params: {},
        ...overrides,
    };
}

function handler(incoming: PricingActionEvent): PricingActionResponse {
    const prices: Record<string, LinePrice> = {};
    for (const line of incoming.actionSubject) {
        const count = Number(line.cartItemFormData?.count ?? 0);
        const held: number[] = line.actionData?.held ?? [];
        prices[line.objKey] = {
            basePrice: count * 5,
            calcPrice: count * 5 * line.itemQuantity,
            applySalesTax: false,
            itemAdditionalInfo: [incoming.params.placingOrder ? 'final' : 'held'],
            actionData: { held },
            saveOnPurchase: held.map(number => ({ objType: 'SolutionObject', dataElementId: 'ticket', number })),
        };
    }
    const value: PricingActionValue = { prices };
    return { responseType: 'singleValueAction', value };
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

describe('pricing Action types', () => {
    it('describe an ordinary pricing pass', () => {
        const response = handler(event({ actionSubject: [line] }));

        expect(response.value.prices['line-1']).toMatchObject({
            basePrice: 10,
            calcPrice: 10,
            itemAdditionalInfo: ['held'],
            actionData: { held: [101, 102] },
        });
        expect(response.value.prices['line-1'].saveOnPurchase).toHaveLength(2);
    });

    it('describe the pass that places the order', () => {
        const response = handler(event({ actionSubject: [line], params: { placingOrder: true } }));

        expect(response.value.prices['line-1'].itemAdditionalInfo).toEqual(['final']);
    });

    it('reject a misspelled order flag and a misspelled price field', () => {
        const incoming = event({});

        // @ts-expect-error the flag is placingOrder
        expect(incoming.params.placingorder).toBeUndefined();

        // @ts-expect-error the field is calcPrice
        const price: LinePrice = { basePrice: 1, calculatedPrice: 1 };
        expect(price.basePrice).toBe(1);
    });
});

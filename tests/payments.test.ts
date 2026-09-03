import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { lastValueFrom } from 'rxjs';
import {
    initialize,
    submitStandalonePayment,
    submitStandalonePaymentAsObservable,
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

beforeEach(() => {
    vi.clearAllMocks();
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
        },
        params: {},
        authToken: 'TOKEN',
    } as any);
});

describe('submitStandalonePayment / submitStandalonePaymentAsObservable', () => {
    it('posts the standalone payment request to the payments service using assumed context values', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                paymentKey: 'pmt1',
                paymentSummary: 'Paid $10.00 on 2026-03-23 12:00 PM',
            },
        });

        const result = await submitStandalonePayment({
            payerKey: 'payer1',
            payeeKey: 'org1',
            paymentAmount: 10,
            preAuthResult: {
                userBillingInfo: {},
                paymentMethod: 'creditCardOrOther',
                tokenId: 'tok_123',
            },
            hostObjectKey: 'host1',
            hostElementId: 'invoice',
            hostAttributeId: 'paymentStatus',
            generateTransaction: true,
            chargeDescription: 'Invoice payment',
        });

        const [url, body, config] = mockedAxios.post.mock.calls[0];
        expect(url).toBe('https://svc/payments/sandboxes/sb/standalonePayment');
        expect(body).toMatchObject({
            organizationKey: 'org1',
            payerKey: 'payer1',
            payerType: 'SolutionUserProxy',
            payeeKey: 'org1',
            paymentAmount: 10,
            hostObjectKey: 'host1',
            hostElementId: 'invoice',
            hostAttributeId: 'paymentStatus',
            generateTransaction: true,
            chargeDescription: 'Invoice payment',
            bankAccountPayment: false,
            preAuthResult: {
                paymentGateway: 'stripe',
                userBillingInfo: {},
                paymentMethod: 'creditCardOrOther',
                tokenId: 'tok_123',
            },
        });
        expect(config.headers.Authorization).toBe('Bearer TOKEN');
        expect(result.paymentKey).toBe('pmt1');
    });

    it('infers bankAccountPayment for common ACH payment methods when omitted', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                paymentKey: 'pmt2',
                paymentSummary: 'Paid $25.00 on 2026-03-23 12:00 PM',
            },
        });

        await submitStandalonePayment({
            payerKey: 'payer1',
            payeeKey: 'org1',
            paymentAmount: 25,
            preAuthResult: {
                userBillingInfo: {},
                paymentMethod: 'us_bank_account',
            },
            hostObjectKey: 'host1',
            hostElementId: 'invoice',
            hostAttributeId: 'paymentStatus',
        });

        const [, body] = mockedAxios.post.mock.calls[0];
        expect(body.bankAccountPayment).toBe(true);
    });

    it('preserves an explicit bankAccountPayment override', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                paymentKey: 'pmt3',
                paymentSummary: 'Paid $25.00 on 2026-03-23 12:00 PM',
            },
        });

        await submitStandalonePayment({
            payerKey: 'payer1',
            payeeKey: 'org1',
            paymentAmount: 25,
            preAuthResult: {
                userBillingInfo: {},
                paymentMethod: 'us_bank_account',
            },
            bankAccountPayment: false,
            hostObjectKey: 'host1',
            hostElementId: 'invoice',
            hostAttributeId: 'paymentStatus',
        });

        const [, body] = mockedAxios.post.mock.calls[0];
        expect(body.bankAccountPayment).toBe(false);
    });

    it('throws when userContext.orgKey is unavailable', async () => {
        initialize({
            sandboxKey: 'sb',
            serviceAddress: 'https://svc',
            actionSubject: {},
            userContext: {
                user: { objKey: 'user1' },
                userProxy: {},
                orgProxy: {},
                orgProxyKey: 'orgProxy1',
                orgKey: '',
                userProxyKey: 'userProxy1',
            },
            params: {},
            authToken: 'TOKEN',
        } as any);

        await expect(submitStandalonePayment({
            payerKey: 'payer1',
            payeeKey: 'org1',
            paymentAmount: 25,
            preAuthResult: {
                userBillingInfo: {},
            },
            hostObjectKey: 'host1',
            hostElementId: 'invoice',
            hostAttributeId: 'paymentStatus',
        })).rejects.toThrow('userContext.orgKey is required');
    });

    it('observable wrapper resolves the same response', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                paymentKey: 'pmt4',
                paymentSummary: 'Paid $30.00 on 2026-03-23 12:00 PM',
            },
        });

        const result = await lastValueFrom(submitStandalonePaymentAsObservable({
            payerKey: 'payer1',
            payeeKey: 'org1',
            paymentAmount: 30,
            preAuthResult: {
                userBillingInfo: {},
                paymentMethod: 'creditCardOrOther',
                paymentMethodToken: 'pm_123',
            },
            hostObjectKey: 'host1',
            hostElementId: 'invoice',
            hostAttributeId: 'paymentStatus',
        }));

        expect(result.paymentKey).toBe('pmt4');
        expect(result.paymentSummary).toContain('Paid $30.00');
    });
});

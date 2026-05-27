import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import {
    getEnabledPaymentReminders,
    getInvoicesMatchingReminder,
    getReminderDeliveryCoverage,
    initialize,
    listEnrolledOrganizations,
} from '../src/index';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('invoice payment reminder helpers', () => {

    beforeEach(() => {
        vi.clearAllMocks();

        initialize({
            body: {
                sandboxKey: 'sbx~test',
                serviceAddress: 'https://features.example',
                actionSubject: {},
                userContext: {
                    user: { objKey: 'usr~test' },
                    userProxy: {},
                    orgProxy: {},
                    orgProxyKey: 'dis!~org',
                    orgKey: 'org~test',
                    userProxyKey: 'con!~payer',
                },
                params: {},
                authToken: 'TOKEN',
            } as any,
        });
    });

    it('lists enabled payment reminders through a scoped data query', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: [{ objKey: 'pmr~1', organizationKey: 'org~test', enabled: true }],
        });

        const reminders = await getEnabledPaymentReminders('org~test');

        const [url, config] = mockedAxios.get.mock.calls[0];
        expect(url).toBe('https://features.example/schema/sandboxes/sbx~test/paymentReminder');
        expect(config.headers.Authorization).toBe('Bearer TOKEN');
        expect(config.params.get('filter')).toBe('(enabled=boolean:true) AND (organizationKey=string:org~test)');
        expect(reminders).toEqual([{ objKey: 'pmr~1', organizationKey: 'org~test', enabled: true }]);
    });

    it('posts reminder invoice matching criteria to the billing endpoint', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: [{
                payerKey: 'con!~payer',
                payerType: 'Contact',
                payerName: 'Alan Zzample',
                items: [{ invoiceKey: 'stx~1', amountDue: 100 }],
                totalBalance: 100,
            }],
        });

        const result = await getInvoicesMatchingReminder('org~test', {
            sendType: 'dueDateRelative',
            dueDateOffsets: [-6],
        }, '2026-05-27');

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://features.example/billing/sandboxes/sbx~test/invoices/matchingReminder',
            {
                orgKey: 'org~test',
                criteria: { sendType: 'dueDateRelative', dueDateOffsets: [-6] },
                today: '2026-05-27',
            },
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer TOKEN' }),
            }),
        );
        expect(result[0].totalBalance).toBe(100);
    });

    it('lists organizations enrolled in a solution', async () => {
        mockedAxios.get.mockResolvedValueOnce({
            data: [{ orgKey: 'org~test', orgProxyKey: 'dis!~org', orgName: 'Test Org' }],
        });

        const orgs = await listEnrolledOrganizations('sol~test');

        expect(mockedAxios.get).toHaveBeenCalledWith(
            'https://features.example/billing/sandboxes/sbx~test/solutions/sol~test/enrolledOrganizations',
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer TOKEN' }),
            }),
        );
        expect(orgs).toEqual([{ orgKey: 'org~test', orgProxyKey: 'dis!~org', orgName: 'Test Org' }]);
    });

    it('requests same-day reminder delivery coverage per channel', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: { email: 'covered', sms: 'retryable' },
        });

        const coverage = await getReminderDeliveryCoverage({
            reminderKey: 'pmr~test',
            payerKey: 'con!~payer',
            organizationProxyKey: 'dis!~org',
            dayStart: '2026-05-27T04:00:00Z',
            nextDayStart: '2026-05-28T04:00:00Z',
            channels: ['email', 'sms'],
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://features.example/billing/sandboxes/sbx~test/reminders/coverage',
            {
                reminderKey: 'pmr~test',
                payerKey: 'con!~payer',
                organizationProxyKey: 'dis!~org',
                dayStart: '2026-05-27T04:00:00Z',
                nextDayStart: '2026-05-28T04:00:00Z',
                channels: ['email', 'sms'],
            },
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: 'Bearer TOKEN' }),
            }),
        );
        expect(coverage).toEqual({ email: 'covered', sms: 'retryable' });
    });
});

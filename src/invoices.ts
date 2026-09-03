// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/invoices
 * @description Invoice and payment-reminder helpers for Halix action lambdas.
 */

import axios from 'axios';
import { lastValueFrom } from 'rxjs';
import { sandboxKey, serviceAddress, getAuthToken } from './sdk-general.js';
import { getAccessibleObjects } from './data-crud.js';

export interface InvoiceDueItem {
    /** Invoice (sales transaction) key. */
    invoiceKey: string;
    /** User-facing invoice ID from the SalesTransaction id field. */
    invoiceId: string;
    /** Backwards-compatible alias for invoiceId. */
    invoiceNumber: string;
    /** User-facing description, e.g. "Down payment on Tuition Kindergarten SY26-27". */
    description: string;
    /** Due date — either the invoice's top-level dueDate or an installment's dueDate. */
    dueDate: string;
    /** Due date formatted for message display as M/d/yyyy. */
    dueDateDisplay: string;
    /** When the matching due date came from an installment, the 0-based index in installmentItems. */
    installmentIndex?: number;
    /** Amount remaining for this invoice/installment. */
    amountDue: number;
    /** Line-item summaries suitable for inclusion in a reminder message. */
    lineItems: Array<{ description: string; quantity: number; amount: number }>;
}

export interface PayerInvoiceGroup {
    payerKey: string;
    payerType: string;
    payerName: string;
    items: InvoiceDueItem[];
    totalBalance: number;
}

export interface ReminderMatchCriteria {
    sendType: 'specificDates' | 'dueDateRelative';
    specificDates?: string[];
    dueDateOffsets?: number[];
}

export interface PaymentReminderRecord {
    objKey: string;
    organizationKey: string;
    sandboxKey: string;
    name: string;
    enabled: boolean;
    previewMode?: boolean;
    channel: 'email' | 'sms' | 'both';
    emailSubject?: string;
    emailBody?: string;
    smsBody?: string;
    sendType: 'specificDates' | 'dueDateRelative';
    specificDates?: string[];
    dueDateOffsets?: number[];
    bccEmail?: string;
}

export type ChannelCoverage = 'covered' | 'retryable' | 'unsent';

async function authHeaders() {
    if (!getAuthToken) {
        throw new Error('SDK not initialized.');
    }
    const authToken = await lastValueFrom(getAuthToken());
    return { Authorization: `Bearer ${authToken}` };
}

export async function getEnabledPaymentReminders(orgKey: string): Promise<PaymentReminderRecord[]> {
    const filter = `(enabled=boolean:true) AND (organizationKey=string:${orgKey})`;
    return getAccessibleObjects('paymentReminder', filter) as Promise<PaymentReminderRecord[]>;
}

export async function getInvoicesMatchingReminder(
    orgKey: string,
    criteria: ReminderMatchCriteria,
    today: string
): Promise<PayerInvoiceGroup[]> {
    const url = `${serviceAddress}/billing/sandboxes/${sandboxKey}/invoices/matchingReminder`;
    const response = await axios.post(url, { orgKey, criteria, today }, { headers: await authHeaders() });
    return response.data;
}

export async function listEnrolledOrganizations(solutionKey: string): Promise<{ orgKey: string; orgProxyKey: string; orgProxyType: string; orgName: string; timezone?: string }[]> {
    const url = `${serviceAddress}/billing/sandboxes/${sandboxKey}/solutions/${solutionKey}/enrolledOrganizations`;
    const response = await axios.get(url, { headers: await authHeaders() });
    return response.data;
}

export async function getReminderDeliveryCoverage(args: {
    reminderKey: string;
    payerKey: string;
    organizationProxyKey: string;
    organizationProxyType?: string;
    dayStart: string;
    nextDayStart: string;
    channels: ('email' | 'sms')[];
}): Promise<Record<'email' | 'sms', ChannelCoverage>> {
    const url = `${serviceAddress}/billing/sandboxes/${sandboxKey}/reminders/coverage`;
    const response = await axios.post(url, args, { headers: await authHeaders() });
    return response.data;
}

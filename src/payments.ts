// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/payments
 * @description Payment completion helpers for the Halix Platform action SDK. This module provides
 * a wrapper around the `standalonePayment` backend route, which finalizes a payment after a gateway
 * component has already produced a preauthorization result.
 *
 * Typical flow:
 * 1. Client/UI code collects payment details and obtains a gateway preauth result.
 * 2. Action code calls `submitStandalonePayment(...)` with the payer, payee, host object, and preauth result.
 * 3. The platform completes the payment, updates the host object's payment summary field, and optionally
 *    generates a sales transaction.
 */

import axios from 'axios';
import { from, Observable, lastValueFrom } from 'rxjs';
import { sandboxKey, serviceAddress, getAuthToken, userContext } from './sdk-general';

const STANDALONE_PAYMENT_URL = 'payments/sandboxes/:sandboxKey/standalonePayment';
const ASSUMED_PAYER_TYPE = 'SolutionUserProxy';
const ASSUMED_PAYMENT_GATEWAY = 'stripe';
const BANK_ACCOUNT_PAYMENT_METHODS = new Set(['us_bank_account', 'USBankAccount', 'bankAccount']);

/**
 * Simplified Stripe-oriented gateway preauth result shape accepted by the standalone payment endpoint.
 *
 * The SDK assumes Stripe and injects `paymentGateway: 'stripe'` when sending the request. Other gateway-specific
 * fields may still be required by the backend decoder and payment processor, so unknown additional fields are
 * preserved and sent through unchanged.
 */
export interface GatewayPaymentPreauthResult {
    /** Billing info captured during payment entry. */
    userBillingInfo: Record<string, any>;
    /** Payment method identifier such as `creditCardOrOther` or `us_bank_account`. */
    paymentMethod?: string;
    /** Final amount that was preauthorized, including fees when applicable. */
    totalAmount?: number;
    /** Additional Stripe preauth data required by the backend, such as token IDs or saved payment method info. */
    [key: string]: any;
}

/**
 * Request payload for the standalone payment route.
 *
 * Notes:
 * - `organizationKey` is sourced from `userContext.orgKey`.
 * - `payerType` is assumed to be `SolutionUserProxy`.
 * - `hostObjectKey`, `hostElementId`, and `hostAttributeId` identify the solution-defined object field that will be
 *   updated with the returned payment summary when processing completes.
 */
export interface StandalonePaymentRequest {
    /** Payer object key. */
    payerKey: string;
    /** Organization key receiving the payment. */
    payeeKey: string;
    /** Base payment amount before any processing fee adjustments. */
    paymentAmount: number;
    /** Gateway preauthorization result produced by the payment UI flow. */
    preAuthResult: GatewayPaymentPreauthResult;
    /**
     * Whether this payment should be completed as a bank-account/ACH payment.
     *
     * If omitted, the SDK infers it from `preAuthResult.paymentMethod` for common ACH method values.
     */
    bankAccountPayment?: boolean;
    /** Key of the host object to update with payment results. */
    hostObjectKey: string;
    /** Data element ID of the host object to update with payment results. */
    hostElementId: string;
    /** Attribute ID on the host object that must exist in the solution data model to store the payment summary. */
    hostAttributeId: string;
    /** If true, the backend also creates a non-POS sales transaction linked to the host object. */
    generateTransaction?: boolean;
    /** Optional override for the payment/transaction description. */
    chargeDescription?: string;
}

/**
 * Result returned by the standalone payment route.
 */
export interface StandalonePaymentResult {
    /** Persisted payment object key. */
    paymentKey: string;
    /** User-facing payment summary string written back to the host attribute. */
    paymentSummary: string;
}

function resolveBankAccountPayment(request: StandalonePaymentRequest): boolean {
    if (request.bankAccountPayment !== undefined) {
        return request.bankAccountPayment;
    }

    return BANK_ACCOUNT_PAYMENT_METHODS.has(request.preAuthResult?.paymentMethod || '');
}

function resolveOrganizationKey(): string {
    const organizationKey = userContext?.orgKey;

    if (!organizationKey) {
        throw new Error('userContext.orgKey is required for standalone payments; check that initialize(event) has been called with a full userContext');
    }

    return organizationKey;
}

/**
 * Completes a previously preauthorized standalone payment.
 *
 * This endpoint performs the final charge, updates the host object's payment summary attribute,
 * persists billing address information back to the payer, and can optionally generate a linked
 * sales transaction.
 */
export async function submitStandalonePayment(request: StandalonePaymentRequest): Promise<StandalonePaymentResult> {
    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    const url = `${serviceAddress}/${STANDALONE_PAYMENT_URL.replace(':sandboxKey', sandboxKey)}`;
    const authToken = await lastValueFrom(getAuthToken());
    const payload = {
        ...request,
        organizationKey: resolveOrganizationKey(),
        payerType: ASSUMED_PAYER_TYPE,
        bankAccountPayment: resolveBankAccountPayment(request),
        preAuthResult: {
            paymentGateway: ASSUMED_PAYMENT_GATEWAY,
            ...request.preAuthResult,
        },
    };

    console.log('Sending POST request to ' + url + ' with token ' + authToken);

    const response = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${authToken}` },
    });

    return response.data;
}

/**
 * Observable version of submitStandalonePayment. See submitStandalonePayment for details.
 */
export function submitStandalonePaymentAsObservable(request: StandalonePaymentRequest): Observable<StandalonePaymentResult> {
    return from(submitStandalonePayment(request));
}

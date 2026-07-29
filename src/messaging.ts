// Halix SDK License v1.0
// Copyright (c) 2025 halix.io LLC.
//
// This source code is licensed for use **only** within applications
// running on the Halix platform, in accordance with Halix SDK guidelines.
//
// Unauthorized use outside the Halix platform is prohibited.
// Full license terms available in the LICENSE file.

/**
 * @module @halix/action-sdk/messaging
 * @description Messaging and notification functions for the Halix Platform action SDK. This module
 * provides functions for sending messages (email, text) through the Halix notification service.
 */

import axios from 'axios';
import { from, Observable, lastValueFrom } from 'rxjs';
import { sandboxKey, serviceAddress, getAuthToken } from './sdk-general.js';

// ================================================================================
// ENUMS & CONSTANTS
// ================================================================================

/**
 * MessageMethod represents the delivery method for a message.
 */
export enum MessageMethod {
    /** Send as email */
    Email = "email",
    /** Send as text/SMS */
    Text = "text",
    /** Send as both email and text */
    EmailAndText = "email,text"
}

// ================================================================================
// INTERFACES
// ================================================================================

/**
 * MessageRequest represents the structure for sending a message through the notification service.
 * 
 * Messages can be sent to:
 * - **userProxyKeys**: The email address/phone number on file for each user proxy will be used
 * - **directEmailAddresses**: Emails sent directly to the specified addresses
 * - **Both**: You can combine both types of recipients
 * 
 * At least one of userProxyKeys or directEmailAddresses must be provided.
 */
export interface MessageRequest {
    /** Subject line for email messages */
    subject: string;
    /** HTML body content of the message */
    body: string;
    /** Array of user proxy keys to send the message to (email addresses/phone numbers on file will be used) */
    userProxyKeys?: string[];
    /** Array of email addresses to send directly to */
    directEmailAddresses?: string[];
    /** The delivery method for the message (defaults to email if not provided) */
    sentAs?: MessageMethod | string;
    /** Email address to use for replies (optional) */
    replyToEmail?: string;
    /** Array of content resource keys to attach to the message (optional) */
    resourceKeys?: string[];
}

// ================================================================================
// INTERNAL INTERFACES (for server communication)
// ================================================================================

/**
 * RecipientGroup represents a group of recipients for a message (internal).
 * @internal
 */
interface RecipientGroup {
    type: string;
    key?: string;
    recipientKeys: string[];
}

/**
 * ServerMessageRequest represents the full structure sent to the server (internal).
 * @internal
 */
interface ServerMessageRequest {
    recipientGroups: RecipientGroup[];
    sentAs: string;
    type: string;
    subject: string;
    body: string;
    replyToEmail?: string;
    resourceKeys?: string[];
    additionalEmails?: string[];
    linkedObjectType?: string;
    linkedObjectKeys?: string[];
}

// ================================================================================
// MESSAGING FUNCTIONS
// ================================================================================

/**
 * Sends email/text message to recipients. Returns when message is queued (sent asynchronously).
 * 
 * @param orgProxyElementId - Org proxy element ID (e.g., "business")
 * @param orgProxyKey - Org proxy key
 * @param message - MessageRequest with userProxyKeys/directEmailAddresses, subject, body, sentAs, replyToEmail, resourceKeys
 * @returns Promise<void> - resolves when queued
 * 
 * @example
 * await sendMessage('business', businessKey, {
 *   userProxyKeys: [customerKey1, customerKey2],
 *   subject: 'Important Announcement',
 *   body: '<p>This is an important announcement.</p>'
 * });
 */
export async function sendMessage(orgProxyElementId: string, orgProxyKey: string, message: MessageRequest): Promise<void> {

    // Build the server request from the simplified client request
    const serverRequest: ServerMessageRequest = {
        recipientGroups: message.userProxyKeys && message.userProxyKeys.length > 0 ? [
            {
                type: "",
                recipientKeys: message.userProxyKeys
            }
        ] : [],
        sentAs: message.sentAs?.toString() || MessageMethod.Email,
        type: "direct",
        subject: message.subject,
        body: message.body,
        replyToEmail: message.replyToEmail,
        resourceKeys: message.resourceKeys,
        additionalEmails: message.directEmailAddresses
    };

    if (!getAuthToken) {
        const errorMessage = 'SDK not initialized.';
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    let url = `${serviceAddress}/notification/sandboxes/${sandboxKey}/sendMessage/${orgProxyElementId}/${orgProxyKey}`;

    let authToken = await lastValueFrom(getAuthToken());

    console.log("Sending POST request to " + url + " with token " + authToken);

    await axios.post(url, serverRequest, {
        headers: { "Authorization": `Bearer ${authToken}` },
    });

    // Note: The message is sent asynchronously by the notification service
    // This function returns once the message has been queued, not when delivery is complete
}

/**
 * Observable version of sendMessage. See sendMessage for details.
 */
export function sendMessageAsObservable(orgProxyElementId: string, orgProxyKey: string, message: MessageRequest): Observable<void> {
    return from(sendMessage(orgProxyElementId, orgProxyKey, message));
}


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
import { sandboxKey, serviceAddress, getAuthToken } from './sdk-general';

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
 * sendMessage sends a message (email and/or text) to recipients through the Halix notification
 * service. The message is sent asynchronously - this function returns immediately after the
 * message is queued for sending.
 * 
 * @param orgProxyElementId - The ID of the organization proxy element (e.g., "business", "school")
 * @param orgProxyKey - The key of the organization proxy object
 * @param message - The message request object containing recipients, content, and delivery options
 * 
 * @returns Promise that resolves when the message has been queued for sending
 * 
 * @example
 * ```typescript
 * // Send an email to customers (sentAs defaults to email)
 * await sendMessage('business', businessKey, {
 *   userProxyKeys: [customerKey1, customerKey2, customerKey3],
 *   subject: 'Important Announcement',
 *   body: '<p>This is an important announcement.</p>',
 *   replyToEmail: 'sender@example.com'
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Send to user proxies and direct email addresses
 * await sendMessage('business', businessKey, {
 *   userProxyKeys: [clientKey1, clientKey2],
 *   directEmailAddresses: ['manager@example.com'],
 *   sentAs: MessageMethod.EmailAndText,
 *   subject: 'Project Reminder',
 *   body: '<p>Don\'t forget about the deadline.</p>',
 *   resourceKeys: [attachmentKey]
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Send email to direct addresses only (no user proxies)
 * await sendMessage('business', businessKey, {
 *   directEmailAddresses: ['partner@example.com', 'vendor@example.com'],
 *   subject: 'External Notification',
 *   body: '<p>Important information for external stakeholders.</p>'
 * });
 * ```
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
 * sendMessageAsObservable sends a message (email and/or text) to recipients through the Halix
 * notification service. The message is sent asynchronously - this observable completes immediately
 * after the message is queued for sending.
 * 
 * @param orgProxyElementId - The ID of the organization proxy element (e.g., "business", "school")
 * @param orgProxyKey - The key of the organization proxy object
 * @param message - The message request object containing recipients, content, and delivery options
 * 
 * @returns Observable that completes when the message has been queued for sending
 * 
 * @example
 * ```typescript
 * sendMessageAsObservable('business', businessKey, {
 *   userProxyKeys: [customerKey1, customerKey2],
 *   directEmailAddresses: ['admin@example.com'],
 *   subject: 'Monthly Newsletter',
 *   body: '<p>Newsletter content here...</p>'
 * }).subscribe({
 *   next: () => console.log('Message queued for sending'),
 *   error: (err) => console.error('Failed to send message:', err)
 * });
 * ```
 */
export function sendMessageAsObservable(orgProxyElementId: string, orgProxyKey: string, message: MessageRequest): Observable<void> {
    return from(sendMessage(orgProxyElementId, orgProxyKey, message));
}



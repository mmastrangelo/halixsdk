import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import * as sdk from '../src/index';
import { 
    sendMessage, 
    sendMessageAsObservable,
    MessageMethod
} from '../src/messaging';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('sendMessage / sendMessageAsObservable', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Initialize SDK with test data
        sdk.initialize({
            body: {
                sandboxKey: 'testSandbox',
                serviceAddress: 'https://test-service',
                actionSubject: {},
                userContext: {
                    user: { objKey: 'u1' },
                    userProxy: { objType: 'Customer' },
                    orgProxy: { objType: 'Business' },
                    orgProxyKey: 'op1',
                    orgKey: 'org1',
                    userProxyKey: 'up1'
                },
                params: {},
                authToken: 'TEST_TOKEN'
            }
        });
    });

    it('sends message with userProxyKeys only', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        await sendMessage('business', 'biz-123', {
            userProxyKeys: ['customer-1', 'customer-2', 'customer-3'],
            subject: 'Important Announcement',
            body: '<p>This is an important announcement.</p>',
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/notification/sandboxes/testSandbox/sendMessage/business/biz-123',
            expect.objectContaining({
                recipientGroups: [
                    {
                        type: '',
                        recipientKeys: ['customer-1', 'customer-2', 'customer-3']
                    }
                ],
                sentAs: 'email',
                type: 'direct',
                subject: 'Important Announcement',
                body: '<p>This is an important announcement.</p>'
            }),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer TEST_TOKEN'
                })
            })
        );
    });

    it('sends message with directEmailAddresses only', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        await sendMessage('business', 'biz-123', {
            directEmailAddresses: ['partner@example.com', 'vendor@example.com'],
            subject: 'External Notification',
            body: '<p>Important information for external stakeholders.</p>',
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/notification/sandboxes/testSandbox/sendMessage/business/biz-123',
            expect.objectContaining({
                recipientGroups: [],
                sentAs: 'email',
                type: 'direct',
                subject: 'External Notification',
                body: '<p>Important information for external stakeholders.</p>',
                additionalEmails: ['partner@example.com', 'vendor@example.com']
            }),
            expect.any(Object)
        );
    });

    it('sends message with both userProxyKeys and directEmailAddresses', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        await sendMessage('business', 'biz-123', {
            userProxyKeys: ['client-1', 'client-2'],
            directEmailAddresses: ['manager@example.com'],
            subject: 'Project Reminder',
            body: '<p>Don\'t forget about the deadline.</p>',
            sentAs: MessageMethod.EmailAndText
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/notification/sandboxes/testSandbox/sendMessage/business/biz-123',
            expect.objectContaining({
                recipientGroups: [
                    {
                        type: '',
                        recipientKeys: ['client-1', 'client-2']
                    }
                ],
                sentAs: 'email,text',
                additionalEmails: ['manager@example.com']
            }),
            expect.any(Object)
        );
    });

    it('sends message with Email method', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        await sendMessage('business', 'biz-123', {
            userProxyKeys: ['user-1'],
            subject: 'Email Only',
            body: '<p>Email message</p>',
            sentAs: MessageMethod.Email
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                sentAs: 'email'
            }),
            expect.any(Object)
        );
    });

    it('sends message with Text method', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        await sendMessage('business', 'biz-123', {
            userProxyKeys: ['user-1'],
            subject: 'Text Only',
            body: 'Text message',
            sentAs: MessageMethod.Text
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                sentAs: 'text'
            }),
            expect.any(Object)
        );
    });

    it('sends message with EmailAndText method', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        await sendMessage('business', 'biz-123', {
            userProxyKeys: ['user-1'],
            subject: 'Both Methods',
            body: '<p>Message content</p>',
            sentAs: MessageMethod.EmailAndText
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                sentAs: 'email,text'
            }),
            expect.any(Object)
        );
    });

    it('includes replyToEmail when provided', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        await sendMessage('business', 'biz-123', {
            userProxyKeys: ['customer-1'],
            subject: 'Newsletter',
            body: '<p>Newsletter content</p>',
            replyToEmail: 'noreply@example.com'
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                replyToEmail: 'noreply@example.com'
            }),
            expect.any(Object)
        );
    });

    it('includes resourceKeys (attachments) when provided', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        await sendMessage('business', 'biz-123', {
            userProxyKeys: ['client-1'],
            subject: 'Report Attached',
            body: '<p>Please see attached report.</p>',
            resourceKeys: ['resource-1', 'resource-2']
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                resourceKeys: ['resource-1', 'resource-2']
            }),
            expect.any(Object)
        );
    });

    it('defaults sentAs to email when not provided', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        await sendMessage('business', 'biz-123', {
            userProxyKeys: ['user-1'],
            subject: 'Default Method',
            body: '<p>Default message</p>'
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                sentAs: 'email'
            }),
            expect.any(Object)
        );
    });

    it('constructs correct URL with orgProxyElementId and orgProxyKey', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        await sendMessage('school', 'school-456', {
            userProxyKeys: ['student-1'],
            subject: 'Test',
            body: '<p>Test</p>'
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/notification/sandboxes/testSandbox/sendMessage/school/school-456',
            expect.any(Object),
            expect.any(Object)
        );
    });

    it('includes all optional fields when provided', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        await sendMessage('business', 'biz-123', {
            userProxyKeys: ['user-1', 'user-2'],
            directEmailAddresses: ['external@example.com'],
            subject: 'Complete Message',
            body: '<p>Full featured message</p>',
            sentAs: MessageMethod.EmailAndText,
            replyToEmail: 'support@example.com',
            resourceKeys: ['doc-1', 'doc-2']
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                recipientGroups: [
                    {
                        type: '',
                        recipientKeys: ['user-1', 'user-2']
                    }
                ],
                sentAs: 'email,text',
                type: 'direct',
                subject: 'Complete Message',
                body: '<p>Full featured message</p>',
                replyToEmail: 'support@example.com',
                resourceKeys: ['doc-1', 'doc-2'],
                additionalEmails: ['external@example.com']
            }),
            expect.any(Object)
        );
    });

    it('handles empty userProxyKeys array correctly', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        await sendMessage('business', 'biz-123', {
            userProxyKeys: [],
            directEmailAddresses: ['admin@example.com'],
            subject: 'Direct Only',
            body: '<p>Direct email</p>'
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                recipientGroups: [],
                additionalEmails: ['admin@example.com']
            }),
            expect.any(Object)
        );
    });

    it('observable wrapper completes successfully', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        const result = await new Promise<void>((resolve, reject) => {
            sendMessageAsObservable('business', 'biz-123', {
                userProxyKeys: ['customer-1'],
                subject: 'Observable Test',
                body: '<p>Testing observable</p>'
            }).subscribe({
                complete: () => resolve(),
                error: (err) => reject(err)
            });
        });

        expect(mockedAxios.post).toHaveBeenCalled();
        expect(result).toBeUndefined(); // Promise resolves with void
    });

    it('observable wrapper propagates errors', async () => {
        const testError = new Error('Network error');
        mockedAxios.post.mockRejectedValue(testError);

        await expect(
            new Promise((resolve, reject) => {
                sendMessageAsObservable('business', 'biz-123', {
                    userProxyKeys: ['customer-1'],
                    subject: 'Error Test',
                    body: '<p>Testing error</p>'
                }).subscribe({
                    complete: () => resolve(undefined),
                    error: (err) => reject(err)
                });
            })
        ).rejects.toThrow('Network error');
    });

    it('uses authentication token from SDK initialization', async () => {
        mockedAxios.post.mockResolvedValue({ data: {} });

        await sendMessage('business', 'biz-123', {
            userProxyKeys: ['user-1'],
            subject: 'Auth Test',
            body: '<p>Testing auth</p>'
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(Object),
            expect.objectContaining({
                headers: {
                    Authorization: 'Bearer TEST_TOKEN'
                }
            })
        );
    });
});


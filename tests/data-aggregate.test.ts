import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import * as sdk from '../src/index';
import {
    getAggregateData,
    getAggregateDataAsObservable,
    type AggregationRequest,
    type AggregationResponse
} from '../src/data-aggregate';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('getAggregateData / getAggregateDataAsObservable', () => {

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

    it('calls aggregateData endpoint with basic aggregation request', async () => {
        const mockResponse = {
            data: {
                data: [
                    { status: 'pending', count: 5, total: 1500.00 },
                    { status: 'shipped', count: 3, total: 900.00 }
                ]
            }
        };

        mockedAxios.post.mockResolvedValue(mockResponse);

        const request: AggregationRequest = {
            dataElementId: 'order',
            parentDataElementId: 'company',
            parentKey: 'comp-123',
            groups: [{
                groupField: 'status',
                groupDirection: 'asc'
            }],
            aggregations: [
                { aggregation: 'Count', aggregationField: 'objKey' },
                { aggregation: 'Sum', aggregationField: 'totalAmount' }
            ]
        };

        const result = await getAggregateData(request);

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/sandboxes/testSandbox/aggregateData',
            request,
            {
                headers: {
                    Authorization: 'Bearer TEST_TOKEN'
                }
            }
        );

        expect(result).toEqual(mockResponse.data);
    });

    it('calls aggregateData endpoint with filter and transforms', async () => {
        const mockResponse = {
            data: {
                data: [
                    { month: '2024-01', count: 10 },
                    { month: '2024-02', count: 15 }
                ]
            }
        };

        mockedAxios.post.mockResolvedValue(mockResponse);

        const request: AggregationRequest = {
            dataElementId: 'order',
            parentDataElementId: 'company',
            parentKey: 'comp-123',
            filter: 'status == "active"',
            groups: [{
                groupField: 'createdDate',
                groupDirection: 'asc',
                transforms: [{
                    transform: 'Month',
                    args: {}
                }]
            }],
            sort: [{
                sortField: 'totalAmount',
                sortDirection: 'desc',
                sortAggregation: 'Sum'
            }],
            aggregations: [
                { aggregation: 'Count', aggregationField: 'objKey' }
            ]
        };

        const result = await getAggregateData(request);

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/sandboxes/testSandbox/aggregateData',
            request,
            {
                headers: {
                    Authorization: 'Bearer TEST_TOKEN'
                }
            }
        );

        expect(result).toEqual(mockResponse.data);
    });

    it('observable wrapper returns the same data', async () => {
        const mockResponse = {
            data: {
                data: [
                    { category: 'A', avgValue: 25.5 },
                    { category: 'B', avgValue: 30.2 }
                ]
            }
        };

        mockedAxios.post.mockResolvedValue(mockResponse);

        const request: AggregationRequest = {
            dataElementId: 'item',
            groups: [{
                groupField: 'category',
                groupDirection: 'asc'
            }],
            aggregations: [
                { aggregation: 'Average', aggregationField: 'value' }
            ]
        };

        const observable = getAggregateDataAsObservable(request);
        const result = await observable.toPromise();

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/sandboxes/testSandbox/aggregateData',
            request,
            {
                headers: {
                    Authorization: 'Bearer TEST_TOKEN'
                }
            }
        );

        expect(result).toEqual(mockResponse.data);
    });

    it('includes relationship paths in group and aggregation fields', async () => {
        const mockResponse = {
            data: {
                data: [
                    { customerName: 'John Doe', orderCount: 3 },
                    { customerName: 'Jane Smith', orderCount: 7 }
                ]
            }
        };

        mockedAxios.post.mockResolvedValue(mockResponse);

        const request: AggregationRequest = {
            dataElementId: 'order',
            parentDataElementId: 'company',
            parentKey: 'comp-123',
            groups: [{
                groupField: 'customer.lastName',
                groupDirection: 'asc'
            }],
            aggregations: [
                { aggregation: 'Count', aggregationField: 'objKey' }
            ]
        };

        const result = await getAggregateData(request);

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/sandboxes/testSandbox/aggregateData',
            request,
            {
                headers: {
                    Authorization: 'Bearer TEST_TOKEN'
                }
            }
        );

        expect(result).toEqual(mockResponse.data);
    });

    it('handles string transform with arguments', async () => {
        const mockResponse = {
            data: {
                data: [
                    { codePrefix: 'ABC', count: 5 },
                    { codePrefix: 'DEF', count: 8 }
                ]
            }
        };

        mockedAxios.post.mockResolvedValue(mockResponse);

        const request: AggregationRequest = {
            dataElementId: 'product',
            groups: [{
                groupField: 'productCode',
                groupDirection: 'asc',
                transforms: [{
                    transform: 'Substring',
                    args: {
                        startIndex: 0,
                        length: 3
                    }
                }]
            }],
            aggregations: [
                { aggregation: 'Count', aggregationField: 'objKey' }
            ]
        };

        const result = await getAggregateData(request);

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/sandboxes/testSandbox/aggregateData',
            request,
            {
                headers: {
                    Authorization: 'Bearer TEST_TOKEN'
                }
            }
        );

        expect(result).toEqual(mockResponse.data);
    });

});

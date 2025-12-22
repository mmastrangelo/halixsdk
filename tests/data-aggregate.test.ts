import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import * as sdk from '../src/index';
import {
    getAggregateData,
    getAggregateDataAsObservable,
    AggregationResponse,
    type AggregationRequest
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
                    { status: 'pending', count_objKey: 5, sum_totalAmount: 1500.00 },
                    { status: 'shipped', count_objKey: 3, sum_totalAmount: 900.00 }
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

        expect(result).toBeInstanceOf(AggregationResponse);
        expect(result.getData()).toEqual(mockResponse.data.data);
        expect(result.length).toBe(2);
    });

    it('calls aggregateData endpoint with filter and transforms', async () => {
        const mockResponse = {
            data: {
                data: [
                    { createdDate: '2024-01', count_objKey: 10 },
                    { createdDate: '2024-02', count_objKey: 15 }
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

        expect(result).toBeInstanceOf(AggregationResponse);
        expect(result.getData()).toEqual(mockResponse.data.data);
    });

    it('observable wrapper returns the same data', async () => {
        const mockResponse = {
            data: {
                data: [
                    { category: 'A', average_value: 25.5 },
                    { category: 'B', average_value: 30.2 }
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

        expect(result).toBeInstanceOf(AggregationResponse);
        expect(result?.getData()).toEqual(mockResponse.data.data);
    });

    it('includes relationship paths in group and aggregation fields', async () => {
        const mockResponse = {
            data: {
                data: [
                    { 'customer.lastName': 'Doe', count_objKey: 3 },
                    { 'customer.lastName': 'Smith', count_objKey: 7 }
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

        expect(result).toBeInstanceOf(AggregationResponse);
        expect(result.getData()).toEqual(mockResponse.data.data);
    });

    it('handles string transform with arguments', async () => {
        const mockResponse = {
            data: {
                data: [
                    { productCode: 'ABC', count_objKey: 5 },
                    { productCode: 'DEF', count_objKey: 8 }
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

        expect(result).toBeInstanceOf(AggregationResponse);
        expect(result.getData()).toEqual(mockResponse.data.data);
    });

    describe('AggregationResponse class functionality', () => {
        it('provides intuitive access to aggregation values', async () => {
            const mockResponse = {
                data: {
                    data: [
                        { status: 'Draft', homeLanguage: 'English', count_objKey: 51, min_homeLanguage: 'English' },
                        { status: 'Submitted', homeLanguage: 'English', count_objKey: 125, min_homeLanguage: 'English' },
                        { status: 'Verified', homeLanguage: 'English', count_objKey: 203, min_homeLanguage: 'English' }
                    ]
                }
            };

            mockedAxios.post.mockResolvedValue(mockResponse);

            const request: AggregationRequest = {
                dataElementId: 'registration',
                parentDataElementId: 'district',
                parentKey: 'dist-123',
                groups: [
                    { groupField: 'status', groupDirection: 'asc' },
                    { groupField: 'homeLanguage', groupDirection: 'asc' }
                ],
                aggregations: [
                    { aggregation: 'Count', aggregationField: 'objKey' },
                    { aggregation: 'Min', aggregationField: 'homeLanguage' }
                ]
            };

            const result = await getAggregateData(request);

            // Test basic properties
            expect(result.length).toBe(3);
            expect(result.getRow(0)).toEqual(mockResponse.data.data[0]);

            // Test getAggregation with case variations
            const firstRow = result.getRow(0)!;
            expect(result.getAggregation(firstRow, 'Count', 'objKey')).toBe(51);
            expect(result.getAggregation(firstRow, 'count', 'objKey')).toBe(51);
            expect(result.getAggregation(firstRow, 'COUNT', 'objKey')).toBe(51);
            expect(result.getAggregation(firstRow, 'Min', 'homeLanguage')).toBe('English');

            // Test getGroup
            expect(result.getGroup(firstRow, 'status')).toBe('Draft');
            expect(result.getGroup(firstRow, 'homeLanguage')).toBe('English');
        });

        it('finds rows by group filters', async () => {
            const mockResponse = {
                data: {
                    data: [
                        { status: 'Draft', homeLanguage: 'English', count_objKey: 51 },
                        { status: 'Draft', homeLanguage: 'Spanish', count_objKey: 1 },
                        { status: 'Submitted', homeLanguage: 'English', count_objKey: 125 },
                        { status: 'Verified', homeLanguage: 'English', count_objKey: 203 }
                    ]
                }
            };

            mockedAxios.post.mockResolvedValue(mockResponse);

            const result = await getAggregateData({
                dataElementId: 'registration',
                groups: [{ groupField: 'status', groupDirection: 'asc' }],
                aggregations: [{ aggregation: 'Count', aggregationField: 'objKey' }]
            });

            // Find by single group
            const draftRows = result.findByGroups({ status: 'Draft' });
            expect(draftRows).toHaveLength(2);
            expect(draftRows[0].status).toBe('Draft');

            // Find by multiple groups
            const specificRows = result.findByGroups({ status: 'Draft', homeLanguage: 'English' });
            expect(specificRows).toHaveLength(1);
            expect(specificRows[0].count_objKey).toBe(51);
        });

        it('gets aggregation values by group filters', async () => {
            const mockResponse = {
                data: {
                    data: [
                        { status: 'Draft', homeLanguage: 'English', count_objKey: 51 },
                        { status: 'Submitted', homeLanguage: 'English', count_objKey: 125 },
                        { status: 'Verified', homeLanguage: 'English', count_objKey: 203 }
                    ]
                }
            };

            mockedAxios.post.mockResolvedValue(mockResponse);

            const result = await getAggregateData({
                dataElementId: 'registration',
                groups: [{ groupField: 'status', groupDirection: 'asc' }],
                aggregations: [{ aggregation: 'Count', aggregationField: 'objKey' }]
            });

            // Get specific aggregation value
            const verifiedCount = result.getAggregationValue(
                { status: 'Verified', homeLanguage: 'English' },
                'Count',
                'objKey'
            );
            expect(verifiedCount).toBe(203);

            // Non-existent group returns undefined
            const nonExistent = result.getAggregationValue(
                { status: 'Invalid' },
                'Count',
                'objKey'
            );
            expect(nonExistent).toBeUndefined();
        });

        it('supports iteration with for...of', async () => {
            const mockResponse = {
                data: {
                    data: [
                        { status: 'Draft', count_objKey: 51 },
                        { status: 'Submitted', count_objKey: 125 },
                        { status: 'Verified', count_objKey: 203 }
                    ]
                }
            };

            mockedAxios.post.mockResolvedValue(mockResponse);

            const result = await getAggregateData({
                dataElementId: 'registration',
                groups: [{ groupField: 'status', groupDirection: 'asc' }],
                aggregations: [{ aggregation: 'Count', aggregationField: 'objKey' }]
            });

            const statuses: string[] = [];
            for (const row of result) {
                statuses.push(row.status);
            }

            expect(statuses).toEqual(['Draft', 'Submitted', 'Verified']);
        });

        it('provides forEach, map, and filter methods', async () => {
            const mockResponse = {
                data: {
                    data: [
                        { status: 'Draft', count_objKey: 51 },
                        { status: 'Submitted', count_objKey: 125 },
                        { status: 'Verified', count_objKey: 203 }
                    ]
                }
            };

            mockedAxios.post.mockResolvedValue(mockResponse);

            const result = await getAggregateData({
                dataElementId: 'registration',
                groups: [{ groupField: 'status', groupDirection: 'asc' }],
                aggregations: [{ aggregation: 'Count', aggregationField: 'objKey' }]
            });

            // forEach
            let total = 0;
            result.forEach(row => {
                total += row.count_objKey;
            });
            expect(total).toBe(379);

            // map
            const counts = result.map(row => row.count_objKey);
            expect(counts).toEqual([51, 125, 203]);

            // filter
            const highCounts = result.filter(row => row.count_objKey > 100);
            expect(highCounts).toHaveLength(2);
        });

        it('gets unique group values', async () => {
            const mockResponse = {
                data: {
                    data: [
                        { status: 'Draft', homeLanguage: 'English', count_objKey: 51 },
                        { status: 'Draft', homeLanguage: 'Spanish', count_objKey: 1 },
                        { status: 'Submitted', homeLanguage: 'English', count_objKey: 125 },
                        { status: 'Submitted', homeLanguage: null, count_objKey: 5 },
                        { status: 'Verified', homeLanguage: 'English', count_objKey: 203 }
                    ]
                }
            };

            mockedAxios.post.mockResolvedValue(mockResponse);

            const result = await getAggregateData({
                dataElementId: 'registration',
                groups: [{ groupField: 'status', groupDirection: 'asc' }],
                aggregations: [{ aggregation: 'Count', aggregationField: 'objKey' }]
            });

            const statuses = result.getUniqueGroupValues('status');
            expect(statuses).toEqual(['Draft', 'Submitted', 'Verified']);

            const languages = result.getUniqueGroupValues('homeLanguage');
            // null values are excluded
            expect(languages).toEqual(['English', 'Spanish']);
        });

        it('sums aggregation values across all rows', async () => {
            const mockResponse = {
                data: {
                    data: [
                        { status: 'Draft', count_objKey: 51, sum_totalAmount: 1500.00 },
                        { status: 'Submitted', count_objKey: 125, sum_totalAmount: 3750.50 },
                        { status: 'Verified', count_objKey: 203, sum_totalAmount: 6100.25 }
                    ]
                }
            };

            mockedAxios.post.mockResolvedValue(mockResponse);

            const result = await getAggregateData({
                dataElementId: 'registration',
                groups: [{ groupField: 'status', groupDirection: 'asc' }],
                aggregations: [
                    { aggregation: 'Count', aggregationField: 'objKey' },
                    { aggregation: 'Sum', aggregationField: 'totalAmount' }
                ]
            });

            const totalCount = result.sumAggregation('Count', 'objKey');
            expect(totalCount).toBe(379);

            const totalAmount = result.sumAggregation('Sum', 'totalAmount');
            expect(totalAmount).toBeCloseTo(11350.75, 2);
        });
    });

});

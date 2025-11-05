import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { of } from 'rxjs';
import * as sdk from '../src/index';
import { getListData, getListDataAsObservable } from '../src/lists';

vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('getListData / getListDataAsObservable', () => {

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

    it('calls authenticated listdata endpoint without search', async () => {
        const mockResponse = { 
            data: { 
                data: [{ id: 1, name: 'Test' }], 
                total: 100,
                selectedRow: 0,
                pageNumber: 1
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            dataElementId: 'customer',
            parentDataElementId: 'company',
            parentKey: 'org1',
            pageNumber: 1,
            pageSize: 50,
            sort: [
                { attributeId: 'lastName', descending: false }
            ]
        };

        const result = await getListData(request);

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/list/sandboxes/testSandbox/listdata',
            request,
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer TEST_TOKEN'
                })
            })
        );
        expect(result).toEqual(mockResponse.data);
        expect(result.total).toBe(100);
        expect(result.pageNumber).toBe(1);
        expect(result.data).toHaveLength(1);
    });

    it('calls public listdata endpoint when isPublic is true', async () => {
        const mockResponse = { 
            data: { 
                data: [], 
                total: 0,
                selectedRow: 0,
                pageNumber: 1
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            dataElementId: 'product',
            parentDataElementId: 'catalog',
            pageNumber: 1,
            pageSize: 20
        };

        const result = await getListData(request, { isPublic: true });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/list/sandboxes/testSandbox/public/listdata',
            request,
            expect.objectContaining({
                headers: {}
            })
        );
        expect(result).toEqual(mockResponse.data);
    });

    it('calls authenticated search endpoint with search parameters', async () => {
        const mockResponse = { 
            data: { 
                data: [], 
                total: 1000,
                selectedRow: 25,
                pageNumber: 1
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            dataElementId: 'customer',
            parentDataElementId: 'company',
            parentKey: 'org1',
            sort: [
                { attributeId: 'lastName', descending: false }
            ]
        };

        const result = await getListData(request, {
            search: {
                attributeId: 'lastName',
                value: 'Smith',
                total: 1000
            }
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/list/sandboxes/testSandbox/listdataSearch',
            request,
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer TEST_TOKEN'
                }),
                params: {
                    attributeId: 'lastName',
                    value: 'Smith',
                    total: '1000'
                }
            })
        );
        expect(result).toEqual(mockResponse.data);
        expect(result.selectedRow).toBe(25);
    });

    it('calls public search endpoint when both isPublic and search are provided', async () => {
        const mockResponse = { 
            data: { 
                data: [], 
                total: 500,
                selectedRow: 10,
                pageNumber: 1
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            dataElementId: 'product',
            parentDataElementId: 'catalog',
            displayFields: ['name', 'price']
        };

        const result = await getListData(request, {
            isPublic: true,
            search: {
                attributeId: 'name',
                value: 'Widget',
                total: 500
            }
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/list/sandboxes/testSandbox/public/listdataSearch',
            request,
            expect.objectContaining({
                headers: {},
                params: {
                    attributeId: 'name',
                    value: 'Widget',
                    total: '500'
                }
            })
        );
        expect(result).toEqual(mockResponse.data);
    });

    it('includes bypassTotal parameter when provided', async () => {
        const mockResponse = { 
            data: { 
                data: [], 
                total: 0,
                selectedRow: 0,
                pageNumber: 1
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            dataElementId: 'customer',
            parentDataElementId: 'company',
            parentKey: 'org1',
            filter: 'status eq "active"'
        };

        await getListData(request, { bypassTotal: true });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/list/sandboxes/testSandbox/listdata',
            request,
            expect.objectContaining({
                params: {
                    bypassTotal: true
                }
            })
        );
    });

    it('observable wrapper returns the same data', async () => {
        const mockResponse = { 
            data: { 
                data: [{ id: 1 }], 
                total: 1,
                selectedRow: 0,
                pageNumber: 1
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            dataElementId: 'customer',
            parentDataElementId: 'company',
            parentKey: 'org1'
        };

        const result = await new Promise((resolve) => {
            getListDataAsObservable(request).subscribe(data => {
                resolve(data);
            });
        });

        expect(result).toEqual(mockResponse.data);
        expect(result.total).toBe(1);
        expect(result.data).toHaveLength(1);
    });
});


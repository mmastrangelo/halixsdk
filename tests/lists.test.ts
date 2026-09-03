import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import * as sdk from '../src/index';
import { 
    getListData, 
    getListDataAsObservable,
    massEdit,
    massEditAsObservable,
    massDelete,
    massDeleteAsObservable,
    type ListDataResponse,
    type MassChangeResponse
} from '../src/lists';

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
                    userProxyKey: 'up1',
                    navigationContext: {
                        navigationKey: 'nav1',
                        navLevel: 'organization',
                        userProxyElementId: 'customer',
                        orgProxyElementId: 'business',
                        userProxyRequired: false,
                        orgProxyKey: 'navOrg1'
                    }
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

    it('sends navigation context when applyContext is true', async () => {
        const mockResponse = {
            data: {
                data: [{ objKey: 'customer1', name: 'Ada' }],
                total: 1,
                selectedRow: 0,
                pageNumber: 1
            }
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            dataElementId: 'customer',
            pageNumber: 1,
            pageSize: 20,
            fields: ['name']
        };

        const result = await getListData(request, { applyContext: true });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/list/sandboxes/testSandbox/listdata',
            {
                dataElementId: 'customer',
                pageNumber: 1,
                pageSize: 20,
                displayFields: ['name'],
                navContext: {
                    navKey: 'nav1',
                    userProxyKey: 'up1',
                    orgProxyKey: 'op1'
                }
            },
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer TEST_TOKEN'
                })
            })
        );
        expect(result).toEqual(mockResponse.data);
    });

    it('rejects public listdata with applyContext', async () => {
        const request = {
            dataElementId: 'product',
            pageNumber: 1,
            pageSize: 20
        };

        await expect(getListData(request, { isPublic: true, applyContext: true }))
            .rejects.toThrow('applyContext cannot be used with public list data');
        expect(mockedAxios.post).not.toHaveBeenCalled();
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
            fields: ['name', 'price']
        };
        const serverRequest = {
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
            serverRequest,
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
        expect((result as ListDataResponse).total).toBe(1);
        expect((result as ListDataResponse).data).toHaveLength(1);
    });
});

describe('massEdit / massEditAsObservable', () => {

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

    it('calls massedit endpoint with literal value', async () => {
        const mockResponse = { 
            data: { 
                tried: 3,
                succeeded: 3,
                failed: 0
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            keys: ['order-123', 'order-456', 'order-789'],
            dataRequest: {
                dataElementId: 'order',
                parentDataElementId: 'company',
                parentKey: 'org1'
            },
            dataElementId: 'order',
            property: 'status',
            valueType: 'literal' as const,
            value: 'shipped'
        };

        const result = await massEdit(request);

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/list/sandboxes/testSandbox/massedit',
            request,
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer TEST_TOKEN'
                })
            })
        );
        expect(result).toEqual(mockResponse.data);
        expect(result.tried).toBe(3);
        expect(result.succeeded).toBe(3);
        expect(result.failed).toBe(0);
    });

    it('calls massedit endpoint with property value', async () => {
        const mockResponse = { 
            data: { 
                tried: 5,
                succeeded: 4,
                failed: 1
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            keys: ['cust-1', 'cust-2', 'cust-3', 'cust-4', 'cust-5'],
            dataRequest: {
                dataElementId: 'customer',
                parentDataElementId: 'company',
                parentKey: 'org1',
                filter: 'status == "active"'
            },
            dataElementId: 'customer',
            property: 'billingAddress',
            valueType: 'property' as const,
            value: 'shippingAddress'
        };

        const result = await massEdit(request);

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/list/sandboxes/testSandbox/massedit',
            request,
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer TEST_TOKEN'
                })
            })
        );
        expect(result.tried).toBe(5);
        expect(result.succeeded).toBe(4);
        expect(result.failed).toBe(1);
    });

    it('calls massedit with sort and filter in dataRequest', async () => {
        const mockResponse = { 
            data: { 
                tried: 10,
                succeeded: 10,
                failed: 0
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            keys: ['inv-1', 'inv-2'],
            dataRequest: {
                dataElementId: 'invoice',
                parentDataElementId: 'company',
                parentKey: 'org1',
                sort: [{ attributeId: 'invoiceDate', descending: true }],
                filter: 'status == "pending"'
            },
            dataElementId: 'invoice',
            property: 'dueDate',
            valueType: 'literal' as const,
            value: '2024-12-31'
        };

        const result = await massEdit(request);

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/list/sandboxes/testSandbox/massedit',
            expect.objectContaining({
                dataRequest: expect.objectContaining({
                    sort: [{ attributeId: 'invoiceDate', descending: true }],
                    filter: 'status == "pending"'
                })
            }),
            expect.any(Object)
        );
        expect(result.succeeded).toBe(10);
    });

    it('observable wrapper returns the same data', async () => {
        const mockResponse = { 
            data: { 
                tried: 2,
                succeeded: 2,
                failed: 0
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            keys: ['rec-1', 'rec-2'],
            dataRequest: {
                dataElementId: 'record',
                parentDataElementId: 'company',
                parentKey: 'org1'
            },
            dataElementId: 'record',
            property: 'flag',
            valueType: 'literal' as const,
            value: true
        };

        const result = await new Promise((resolve) => {
            massEditAsObservable(request).subscribe(data => {
                resolve(data);
            });
        });

        expect(result).toEqual(mockResponse.data);
        expect((result as MassChangeResponse).tried).toBe(2);
        expect((result as MassChangeResponse).succeeded).toBe(2);
    });
});

describe('massDelete / massDeleteAsObservable', () => {

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

    it('calls massdelete endpoint with specific keys', async () => {
        const mockResponse = { 
            data: { 
                tried: 3,
                succeeded: 3,
                failed: 0
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            keys: ['order-123', 'order-456', 'order-789'],
            dataRequest: {
                dataElementId: 'order',
                parentDataElementId: 'company',
                parentKey: 'org1',
                filter: 'status == "cancelled"'
            },
            dataElementId: 'order'
        };

        const result = await massDelete(request);

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/list/sandboxes/testSandbox/massdelete',
            request,
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer TEST_TOKEN'
                })
            })
        );
        expect(result).toEqual(mockResponse.data);
        expect(result.tried).toBe(3);
        expect(result.succeeded).toBe(3);
        expect(result.failed).toBe(0);
    });

    it('calls massdelete with emptyList flag to delete all matching records', async () => {
        const mockResponse = { 
            data: { 
                tried: 15,
                succeeded: 15,
                failed: 0
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            keys: [],
            dataRequest: {
                dataElementId: 'tempRecord',
                parentDataElementId: 'company',
                parentKey: 'org1',
                filter: 'createdDate < "2023-01-01"'
            },
            dataElementId: 'tempRecord',
            emptyList: true
        };

        const result = await massDelete(request);

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/list/sandboxes/testSandbox/massdelete',
            expect.objectContaining({
                emptyList: true
            }),
            expect.any(Object)
        );
        expect(result.tried).toBe(15);
        expect(result.succeeded).toBe(15);
    });

    it('handles partial failures correctly', async () => {
        const mockResponse = { 
            data: { 
                tried: 10,
                succeeded: 7,
                failed: 3
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            keys: Array.from({ length: 10 }, (_, i) => `rec-${i + 1}`),
            dataRequest: {
                dataElementId: 'record',
                parentDataElementId: 'company',
                parentKey: 'org1'
            },
            dataElementId: 'record'
        };

        const result = await massDelete(request);

        expect(result.tried).toBe(10);
        expect(result.succeeded).toBe(7);
        expect(result.failed).toBe(3);
    });

    it('sends fields as displayFields inside massdelete dataRequest', async () => {
        const mockResponse = { 
            data: { 
                tried: 5,
                succeeded: 5,
                failed: 0
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            keys: ['item-1', 'item-2'],
            dataRequest: {
                dataElementId: 'item',
                parentDataElementId: 'category',
                parentKey: 'cat1',
                fields: ['objKey', 'name']
            },
            dataElementId: 'item'
        };

        const result = await massDelete(request);

        expect(mockedAxios.post).toHaveBeenCalledWith(
            'https://test-service/list/sandboxes/testSandbox/massdelete',
            expect.objectContaining({
                dataRequest: expect.objectContaining({
                    displayFields: ['objKey', 'name']
                })
            }),
            expect.any(Object)
        );
        expect(result.succeeded).toBe(5);
    });

    it('observable wrapper returns the same data', async () => {
        const mockResponse = { 
            data: { 
                tried: 4,
                succeeded: 4,
                failed: 0
            } 
        };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const request = {
            keys: ['rec-1', 'rec-2', 'rec-3', 'rec-4'],
            dataRequest: {
                dataElementId: 'record',
                parentDataElementId: 'company',
                parentKey: 'org1'
            },
            dataElementId: 'record'
        };

        const result = await new Promise((resolve) => {
            massDeleteAsObservable(request).subscribe(data => {
                resolve(data);
            });
        });

        expect(result).toEqual(mockResponse.data);
        expect((result as MassChangeResponse).tried).toBe(4);
        expect((result as MassChangeResponse).succeeded).toBe(4);
    });
});

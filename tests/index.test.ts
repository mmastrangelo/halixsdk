import { describe, it, expect, vi } from 'vitest';
import {
    compareValues,
    getValueFromObject,
    sortObjectArray,
    debounceFn,
    prepareSuccessResponse,
    prepareErrorResponse,
} from '../src/index';

describe('compareValues', () => {
    it('compares strings case-insensitively when flag set', () => {
        expect(compareValues('Apple', 'banana', false, true)).toBeLessThan(0);
        expect(compareValues('banana', 'Apple', false, true)).toBeGreaterThan(0);
        expect(compareValues('a', 'A', false, true)).toBe(0);
    });
    
    it('respects descending order', () => {
        expect(compareValues(1, 2, true, false)).toBeGreaterThan(0);
        expect(compareValues(2, 1, true, false)).toBeLessThan(0);
    });
    
    it('handles nullish values for strings with caseInsensitive', () => {
        expect(compareValues('a', undefined as any, false, true)).toBe(-1);
        expect(compareValues(undefined as any, 'a', false, true)).toBe(0);
        expect(compareValues(undefined as any, undefined as any, false, true)).toBe(0);
    });
});

describe('getValueFromObject', () => {
    it('reads nested values with dot path', () => {
        const obj = { a: { b: { c: 42 } } };
        expect(getValueFromObject(obj, 'a.b.c')).toBe(42);
    });
    
    it('resolves relationship key syntax', () => {
        const obj = {
            ownerAccountMemberKey: 'ownerAccountMember',
            ownerAccountMember: { name: 'Owner' },
        };
        expect(getValueFromObject(obj, 'accountMember:ownerAccountMemberKey.name')).toBe('Owner');
    });
});

describe('sortObjectArray', () => {
    it('sorts by multiple fields with precedence', () => {
        const data = [
            { name: 'bob', age: 30 },
            { name: 'Alice', age: 25 },
            { name: 'alice', age: 35 },
        ];
        
        const result = sortObjectArray(data, [
            { attributeId: 'name', caseInsensitive: true },
            { attributeId: 'age', descending: true },
        ]);
        
        expect(result.map(r => `${r.name}:${r.age}`)).toEqual([
            'alice:35', 'Alice:25', 'bob:30'
        ]);
        
        // Explicit order assertions
        expect(result[0].name.toLowerCase()).toBe('alice');
        expect(result[0].age).toBe(35);
        expect(result[1].name.toLowerCase()).toBe('alice');
        expect(result[1].age).toBe(25);
        expect(result[2].name.toLowerCase()).toBe('bob');
    });
});

describe('debounceFn', () => {
    it('debounces invocations within the wait window', async () => {
        vi.useFakeTimers();
        const spy = vi.fn();
        const debounced = debounceFn(spy, 100);
        
        debounced(1);
        debounced(2);
        debounced(3);
        
        expect(spy).not.toHaveBeenCalled();
        vi.advanceTimersByTime(100);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenLastCalledWith(3);
        vi.useRealTimers();
    });
});

describe('prepareSuccessResponse / prepareErrorResponse', () => {
    it('returns direct payloads when useBody is false (default)', () => {
        const success = prepareSuccessResponse({
            responseType: 'singleValueAction',
            isError: false,
            successMessage: 'ok',
            value: 1,
        } as any);
        expect((success as any).responseType).toBe('singleValueAction');
        
        const error = prepareErrorResponse('bad');
        expect((error as any).responseType).toBe('error');
        expect((error as any).errorMessage).toBe('bad');
    });
});



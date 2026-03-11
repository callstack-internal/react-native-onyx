import {act, renderHook} from '@testing-library/react-native';
import Onyx, {useStore} from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import type GenericCollection from '../utils/GenericCollection';
import type {OnyxState, OnyxCollections} from '../../lib/useStore';

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

type TestEntry = {id: string; name: string; unrelated?: string};

Onyx.init({
    keys: ONYXKEYS,
});

/**
 * Helper to select a typed value from the store.
 * Without `CustomTypeOptions` module augmentation the state values are `unknown`,
 * so these helpers keep the casts in one place instead of scattering them across every test.
 */
const selectTestKey = (state: OnyxState) => state[ONYXKEYS.TEST_KEY] as TestEntry | undefined;
const selectTestKey2 = (state: OnyxState) => state[ONYXKEYS.TEST_KEY_2] as {id: string} | undefined;
const selectTestCollection = (_state: OnyxState, collections: OnyxCollections) =>
    collections[ONYXKEYS.COLLECTION.TEST_KEY] as Record<string, TestEntry | undefined> | undefined;

beforeEach(async () => {
    await Onyx.clear();
});

describe('useStore', () => {
    describe('basic usage', () => {
        it('should return undefined when key has no value', async () => {
            const {result} = renderHook(() => useStore(selectTestKey));

            await act(async () => waitForPromisesToResolve());

            expect(result.current).toBeUndefined();
        });

        it('should return cached value for an existing key', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'test_value'});

            const {result} = renderHook(() => useStore(selectTestKey));

            expect(result.current).toEqual({id: '1', name: 'test_value'});
        });

        it('should update when a key value changes', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'initial'});

            const {result} = renderHook(() => useStore((state) => selectTestKey(state)?.name));

            expect(result.current).toEqual('initial');

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'updated'}));

            expect(result.current).toEqual('updated');
        });

        it('should update when a key is merged', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'original'});

            const {result} = renderHook(() => useStore((state) => selectTestKey(state)?.name));

            expect(result.current).toEqual('original');

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {name: 'merged'}));

            expect(result.current).toEqual('merged');
        });

        it('should update when a key is cleared', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'value'});

            const {result} = renderHook(() => useStore(selectTestKey));

            expect(result.current).toEqual({id: '1', name: 'value'});

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, null));

            expect(result.current).toBeUndefined();
        });
    });

    describe('selectors', () => {
        it('should return derived data from a single key', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'Test'});

            const {result} = renderHook(() => useStore((state) => selectTestKey(state)?.name));

            expect(result.current).toEqual('Test');
        });

        it('should return derived data from multiple keys', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'a'});
            await Onyx.set(ONYXKEYS.TEST_KEY_2, {id: '2'});

            const {result} = renderHook(() =>
                useStore((state) => {
                    const a = selectTestKey(state);
                    const b = selectTestKey2(state);
                    return [a?.id, b?.id];
                }),
            );

            expect(result.current).toEqual(['1', '2']);
        });

        it('should update derived data when any source key changes', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '10', name: 'a'});
            await Onyx.set(ONYXKEYS.TEST_KEY_2, {id: '20'});

            const {result} = renderHook(() =>
                useStore((state) => {
                    const a = Number(selectTestKey(state)?.id ?? 0);
                    const b = Number(selectTestKey2(state)?.id ?? 0);
                    return a + b;
                }),
            );

            expect(result.current).toEqual(30);

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, {id: '50', name: 'a'}));

            expect(result.current).toEqual(70);
        });

        it('should not change reference when selector output is deeply equal', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'Test', unrelated: 'a'});

            const {result} = renderHook(() =>
                useStore((state) => {
                    const entry = selectTestKey(state);
                    return {id: entry?.id};
                }),
            );

            const firstResult = result.current;

            // Change an unrelated property — selector output stays deeply equal
            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {unrelated: 'b'}));

            expect(result.current).toEqual(firstResult);
            // Reference should be preserved due to deepEqual memoization
            expect(result.current).toBe(firstResult);
        });
    });

    describe('collections', () => {
        it('should return all entries from a collection via collections param', async () => {
            await Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {id: '1'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {id: '2'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}3`]: {id: '3'},
            } as GenericCollection);

            const {result} = renderHook(() => useStore((_state, collections) => collections[ONYXKEYS.COLLECTION.TEST_KEY]));

            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {id: '1'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {id: '2'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}3`]: {id: '3'},
            });
        });

        it('should update collection when a member changes', async () => {
            await Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {id: '1', name: 'first'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {id: '2', name: 'second'},
            } as GenericCollection);

            const {result} = renderHook(() =>
                useStore((state, collections) => selectTestCollection(state, collections)?.[`${ONYXKEYS.COLLECTION.TEST_KEY}1`]?.name),
            );

            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual('first');

            await act(async () => Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}1`, {name: 'updated'}));
            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual('updated');
        });

        it('should return empty object for collection with no members', async () => {
            const {result} = renderHook(() => useStore((_state, collections) => collections[ONYXKEYS.COLLECTION.TEST_KEY]));

            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual({});
        });
    });

    describe('multiple subscribers', () => {
        it('should independently update multiple hooks selecting different keys', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'value1'});
            await Onyx.set(ONYXKEYS.TEST_KEY_2, {id: 'value2'});

            const {result: result1} = renderHook(() => useStore((state) => selectTestKey(state)?.name));
            const {result: result2} = renderHook(() => useStore((state) => selectTestKey2(state)?.id));

            expect(result1.current).toEqual('value1');
            expect(result2.current).toEqual('value2');

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'changed'}));

            expect(result1.current).toEqual('changed');
            expect(result2.current).toEqual('value2');
        });
    });

    describe('Onyx.clear', () => {
        it('should return undefined after Onyx.clear()', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'value'});

            const {result} = renderHook(() => useStore(selectTestKey));

            expect(result.current).toEqual({id: '1', name: 'value'});

            await act(async () => Onyx.clear());

            expect(result.current).toBeUndefined();
        });

        it('should pick up new values set after Onyx.clear()', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'old'});

            const {result} = renderHook(() => useStore((state) => selectTestKey(state)?.name));

            expect(result.current).toEqual('old');

            await act(async () => Onyx.clear());

            expect(result.current).toBeUndefined();

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'new'}));

            expect(result.current).toEqual('new');
        });
    });
});

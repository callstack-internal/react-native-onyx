import {act, renderHook} from '@testing-library/react-native';
import Onyx, {useStore} from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';
import type GenericCollection from '../utils/GenericCollection';

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

Onyx.init({
    keys: ONYXKEYS,
});

beforeEach(async () => {
    await Onyx.clear();
});

describe('useStore', () => {
    describe('basic usage', () => {
        it('should return undefined when key has no value', async () => {
            const {result} = renderHook(() => useStore((state) => state[ONYXKEYS.TEST_KEY]));

            await act(async () => waitForPromisesToResolve());

            expect(result.current).toBeUndefined();
        });

        it('should return cached value for an existing key', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'test_value');

            const {result} = renderHook(() => useStore((state) => state[ONYXKEYS.TEST_KEY]));

            expect(result.current).toEqual('test_value');
        });

        it('should update when a key value changes', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'initial');

            const {result} = renderHook(() => useStore((state) => state[ONYXKEYS.TEST_KEY]));

            expect(result.current).toEqual('initial');

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'updated'));

            expect(result.current).toEqual('updated');
        });

        it('should update when a key is merged', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {name: 'original'});

            const {result} = renderHook(() => useStore((state) => state[ONYXKEYS.TEST_KEY] as {name: string} | undefined));

            expect(result.current).toEqual({name: 'original'});

            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {name: 'merged'}));

            expect(result.current).toEqual({name: 'merged'});
        });

        it('should update when a key is cleared', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'value');

            const {result} = renderHook(() => useStore((state) => state[ONYXKEYS.TEST_KEY]));

            expect(result.current).toEqual('value');

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, null));

            expect(result.current).toBeUndefined();
        });
    });

    describe('selectors', () => {
        it('should return derived data from a single key', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'Test'});

            const {result} = renderHook(() =>
                useStore((state) => {
                    const entry = state[ONYXKEYS.TEST_KEY] as {id: string; name: string} | undefined;
                    return entry?.name;
                }),
            );

            expect(result.current).toEqual('Test');
        });

        it('should return derived data from multiple keys', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '1'});
            await Onyx.set(ONYXKEYS.TEST_KEY_2, {id: '2'});

            const {result} = renderHook(() =>
                useStore((state) => {
                    const a = state[ONYXKEYS.TEST_KEY] as {id: string} | undefined;
                    const b = state[ONYXKEYS.TEST_KEY_2] as {id: string} | undefined;
                    return [a?.id, b?.id];
                }),
            );

            expect(result.current).toEqual(['1', '2']);
        });

        it('should update derived data when any source key changes', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 10);
            await Onyx.set(ONYXKEYS.TEST_KEY_2, 20);

            const {result} = renderHook(() =>
                useStore((state) => {
                    const a = (state[ONYXKEYS.TEST_KEY] as number) ?? 0;
                    const b = (state[ONYXKEYS.TEST_KEY_2] as number) ?? 0;
                    return a + b;
                }),
            );

            expect(result.current).toEqual(30);

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 50));

            expect(result.current).toEqual(70);
        });

        it('should not change reference when selector output is deeply equal', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, {id: '1', name: 'Test', unrelated: 'a'});

            const selector = (state: Record<string, unknown>) => {
                const entry = state[ONYXKEYS.TEST_KEY] as {id: string; name: string} | undefined;
                return {id: entry?.id};
            };

            const {result} = renderHook(() => useStore(selector));

            const firstResult = result.current;

            // Change an unrelated property — selector output stays deeply equal
            await act(async () => Onyx.merge(ONYXKEYS.TEST_KEY, {unrelated: 'b'}));

            expect(result.current).toEqual(firstResult);
            // Reference should be preserved due to deepEqual memoization
            expect(result.current).toBe(firstResult);
        });
    });

    describe('collections', () => {
        it('should return all entries from a collection', async () => {
            await Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {id: '1'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {id: '2'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}3`]: {id: '3'},
            } as GenericCollection);

            const {result} = renderHook(() =>
                useStore((state) => {
                    const prefix = ONYXKEYS.COLLECTION.TEST_KEY;
                    const entries: Record<string, unknown> = {};
                    for (const key of Object.keys(state)) {
                        if (key.startsWith(prefix) && key.length > prefix.length) {
                            entries[key] = state[key];
                        }
                    }
                    return entries;
                }),
            );

            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual({
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {id: '1'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {id: '2'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}3`]: {id: '3'},
            });
        });

        it('should update when a collection member changes', async () => {
            await Onyx.mergeCollection(ONYXKEYS.COLLECTION.TEST_KEY, {
                [`${ONYXKEYS.COLLECTION.TEST_KEY}1`]: {id: '1', name: 'first'},
                [`${ONYXKEYS.COLLECTION.TEST_KEY}2`]: {id: '2', name: 'second'},
            } as GenericCollection);

            const {result} = renderHook(() =>
                useStore((state) => {
                    const entry = state[`${ONYXKEYS.COLLECTION.TEST_KEY}1`] as {id: string; name: string} | undefined;
                    return entry?.name;
                }),
            );

            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual('first');

            await act(async () => Onyx.merge(`${ONYXKEYS.COLLECTION.TEST_KEY}1`, {name: 'updated'}));
            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual('updated');
        });
    });

    describe('multiple subscribers', () => {
        it('should independently update multiple hooks selecting different keys', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'value1');
            await Onyx.set(ONYXKEYS.TEST_KEY_2, 'value2');

            const {result: result1} = renderHook(() => useStore((state) => state[ONYXKEYS.TEST_KEY]));
            const {result: result2} = renderHook(() => useStore((state) => state[ONYXKEYS.TEST_KEY_2]));

            expect(result1.current).toEqual('value1');
            expect(result2.current).toEqual('value2');

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'changed'));

            expect(result1.current).toEqual('changed');
            // Second hook should be unaffected in value (though its selector ran)
            expect(result2.current).toEqual('value2');
        });
    });

    describe('Onyx.clear', () => {
        it('should return undefined after Onyx.clear()', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'value');

            const {result} = renderHook(() => useStore((state) => state[ONYXKEYS.TEST_KEY]));

            expect(result.current).toEqual('value');

            await act(async () => Onyx.clear());

            expect(result.current).toBeUndefined();
        });

        it('should pick up new values set after Onyx.clear()', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'old');

            const {result} = renderHook(() => useStore((state) => state[ONYXKEYS.TEST_KEY]));

            expect(result.current).toEqual('old');

            await act(async () => Onyx.clear());

            expect(result.current).toBeUndefined();

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'new'));

            expect(result.current).toEqual('new');
        });
    });
});

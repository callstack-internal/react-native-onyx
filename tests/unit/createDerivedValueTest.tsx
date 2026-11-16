import {act, renderHook} from '@testing-library/react-native';

import type {OnyxStateView} from '../../lib/useOnyxState';
import type GenericCollection from '../utils/GenericCollection';

import Onyx from '../../lib';
import createDerivedValue from '../../lib/createDerivedValue';
import useOnyxState from '../../lib/useOnyxState';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYXKEYS = {
    TEST_KEY: 'test',
    OTHER_TEST: 'otherTest',
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

const COLLECTION = ONYXKEYS.COLLECTION.TEST_KEY;

Onyx.init({
    keys: ONYXKEYS,
});

beforeEach(() => Onyx.clear());

/** A state view built by hand, for calling `get` without a hook. */
function stateOf(values: Record<string, unknown>): OnyxStateView {
    return values as OnyxStateView;
}

describe('createDerivedValue', () => {
    it('should compute once per change for every component that reads it, even through inline selectors', async () => {
        // Given a derived value and three components that each pick a different member from it inline
        const compute = jest.fn((state: OnyxStateView) => {
            const items = (state[COLLECTION] ?? {}) as Record<string, {name: string}>;
            const names: Record<string, string> = {};
            for (const [key, item] of Object.entries(items)) {
                names[key] = item.name.toUpperCase();
            }
            return names;
        });
        const names = createDerivedValue({dependencies: [COLLECTION], compute});
        await Onyx.mergeCollection(COLLECTION, {[`${COLLECTION}1`]: {name: 'a'}, [`${COLLECTION}2`]: {name: 'b'}, [`${COLLECTION}3`]: {name: 'c'}} as GenericCollection);
        const hooks = [1, 2, 3].map((id) => renderHook(() => useOnyxState((state) => names.get(state)[`${COLLECTION}${id}`], {dependencies: names.dependencies})));
        await act(async () => waitForPromisesToResolve());
        compute.mockClear();

        // When one member changes
        await act(async () => Onyx.merge(`${COLLECTION}2`, {name: 'bb'}));

        // Then the value is computed once and every component reads its own part of it
        expect(compute).toHaveBeenCalledTimes(1);
        expect(hooks.map(({result}) => result.current)).toEqual(['A', 'BB', 'C']);
    });

    it('should hand compute the previous dependencies and result, so it can update only what changed', async () => {
        // Given a derived value that copies the previous result and recomputes only the changed members
        const recomputed: string[][] = [];
        const names = createDerivedValue({
            dependencies: [COLLECTION],
            compute: (state, previous): Record<string, string> => {
                const items = (state[COLLECTION] ?? {}) as Record<string, {name: string} | undefined>;
                const previousItems = (previous?.state[COLLECTION] ?? {}) as Record<string, {name: string} | undefined>;
                const result = previous ? {...previous.result} : {};
                const changed: string[] = [];
                for (const [key, item] of Object.entries(items)) {
                    if (!previous || item !== previousItems[key]) {
                        result[key] = item?.name.toUpperCase() ?? '';
                        changed.push(key);
                    }
                }
                recomputed.push(changed);
                return result;
            },
        });
        await Onyx.mergeCollection(COLLECTION, {[`${COLLECTION}1`]: {name: 'a'}, [`${COLLECTION}2`]: {name: 'b'}} as GenericCollection);
        const {result} = renderHook(() => useOnyxState((state) => names.get(state), {dependencies: names.dependencies}));
        await act(async () => waitForPromisesToResolve());

        // When one member changes
        await act(async () => Onyx.merge(`${COLLECTION}2`, {name: 'bb'}));

        // Then the first compute covers everything and the second only the changed member
        expect(recomputed).toEqual([[`${COLLECTION}1`, `${COLLECTION}2`], [`${COLLECTION}2`]]);
        expect(result.current).toEqual({[`${COLLECTION}1`]: 'A', [`${COLLECTION}2`]: 'BB'});
    });

    it('should not compute again while its dependencies keep their references', () => {
        // Given a derived value of one key
        const compute = jest.fn((state: OnyxStateView) => state[ONYXKEYS.TEST_KEY]);
        const value = createDerivedValue({dependencies: [ONYXKEYS.TEST_KEY], compute});
        value.get(stateOf({[ONYXKEYS.TEST_KEY]: 'a', [ONYXKEYS.OTHER_TEST]: 'x'}));

        // When it is read again after only a key outside its dependencies changed
        value.get(stateOf({[ONYXKEYS.TEST_KEY]: 'a', [ONYXKEYS.OTHER_TEST]: 'y'}));

        // Then the first result is reused
        expect(compute).toHaveBeenCalledTimes(1);
    });

    it('should move the previous dependencies forward after a compute that returned the same result', () => {
        // Given a derived value whose output ignores one of its dependencies
        const seenPrevious: unknown[] = [];
        const value = createDerivedValue({
            dependencies: [ONYXKEYS.TEST_KEY, ONYXKEYS.OTHER_TEST],
            compute: (state, previous): string => {
                seenPrevious.push(previous?.state[ONYXKEYS.OTHER_TEST]);
                return previous?.result ?? 'constant';
            },
        });
        value.get(stateOf({[ONYXKEYS.OTHER_TEST]: 'w'}));

        // When the ignored dependency changes twice
        value.get(stateOf({[ONYXKEYS.OTHER_TEST]: 'x'}));
        value.get(stateOf({[ONYXKEYS.OTHER_TEST]: 'y'}));

        // Then each compute diffs against the one before it, not against the first
        expect(seenPrevious).toEqual([undefined, 'w', 'x']);
    });

    it('should diff against the last real compute and run again after compute calls keep', () => {
        // Given a derived value that waits while a flag is set
        const seenPrevious: unknown[] = [];
        const value = createDerivedValue({
            dependencies: [ONYXKEYS.TEST_KEY, ONYXKEYS.OTHER_TEST],
            compute: (state, previous): string => {
                seenPrevious.push(previous?.state[ONYXKEYS.TEST_KEY]);
                if (previous && state[ONYXKEYS.OTHER_TEST] === 'wait') {
                    return previous.keep();
                }
                return state[ONYXKEYS.TEST_KEY] as string;
            },
        });
        value.get(stateOf({[ONYXKEYS.TEST_KEY]: 'a'}));

        // When the value changes while it waits, is read twice, and then the wait ends
        const waiting = stateOf({[ONYXKEYS.TEST_KEY]: 'b', [ONYXKEYS.OTHER_TEST]: 'wait'});
        value.get(waiting);
        value.get(waiting);
        const result = value.get(stateOf({[ONYXKEYS.TEST_KEY]: 'b', [ONYXKEYS.OTHER_TEST]: 'go'}));

        // Then every read while waiting runs it again, and the compute after the wait still diffs against 'a'
        expect(seenPrevious).toEqual([undefined, 'a', 'a', 'a']);
        expect(result).toEqual('b');
    });

    it('should run again after compute throws, from the last good result', () => {
        // Given a derived value whose compute fails once
        const seenPrevious: unknown[] = [];
        let shouldThrow = false;
        const value = createDerivedValue({
            dependencies: [ONYXKEYS.TEST_KEY],
            compute: (state, previous): string => {
                seenPrevious.push(previous?.result);
                if (shouldThrow) {
                    shouldThrow = false;
                    throw new Error('compute failed');
                }
                return state[ONYXKEYS.TEST_KEY] as string;
            },
        });
        value.get(stateOf({[ONYXKEYS.TEST_KEY]: 'a'}));

        // When the next compute throws and the same state is read again
        const changed = stateOf({[ONYXKEYS.TEST_KEY]: 'b'});
        shouldThrow = true;
        expect(() => value.get(changed)).toThrow('compute failed');
        const result = value.get(changed);

        // Then the retry computes again from 'a' and succeeds
        expect(seenPrevious).toEqual([undefined, 'a', 'a']);
        expect(result).toEqual('b');
    });

    it('should compute from scratch after reset, also when compute called it', () => {
        // Given a derived value that resets itself when it sees an empty value
        const seenPrevious: boolean[] = [];
        const value = createDerivedValue({
            dependencies: [ONYXKEYS.TEST_KEY],
            compute: (state, previous): string => {
                seenPrevious.push(previous !== undefined);
                if (!state[ONYXKEYS.TEST_KEY]) {
                    value.reset();
                    return '';
                }
                return state[ONYXKEYS.TEST_KEY] as string;
            },
        });
        value.get(stateOf({[ONYXKEYS.TEST_KEY]: 'a'}));

        // When it resets itself and then gets a value again
        value.get(stateOf({[ONYXKEYS.TEST_KEY]: ''}));
        value.get(stateOf({[ONYXKEYS.TEST_KEY]: 'b'}));

        // Then the compute after the reset gets no previous result
        expect(seenPrevious).toEqual([false, true, false]);
    });

    it('should compute from scratch after Onyx.clear', async () => {
        // Given a derived value that was already computed
        const seenPrevious: boolean[] = [];
        const value = createDerivedValue({
            dependencies: [ONYXKEYS.TEST_KEY],
            compute: (state, previous): unknown => {
                seenPrevious.push(previous !== undefined);
                return state[ONYXKEYS.TEST_KEY];
            },
        });
        value.get(stateOf({[ONYXKEYS.TEST_KEY]: 'a'}));

        // When Onyx is cleared, say on sign-out, and the value is read again
        await Onyx.clear();
        value.get(stateOf({[ONYXKEYS.TEST_KEY]: 'b'}));

        // Then nothing from before the clear is carried over
        expect(seenPrevious).toEqual([false, false]);
    });
});

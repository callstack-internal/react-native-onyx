import {act, renderHook} from '@testing-library/react-native';

import type {OnyxStateView} from '../../lib/useOnyxState';
import type GenericCollection from '../utils/GenericCollection';

import Onyx from '../../lib';
import {resetDeferredInitTask} from '../../lib/OnyxUtils';
import StorageMock from '../../lib/storage';
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
const MEMBER_1 = `${COLLECTION}1`;
const MEMBER_2 = `${COLLECTION}2`;

Onyx.init({
    keys: ONYXKEYS,
});

beforeEach(() => Onyx.clear());

describe('useOnyxState', () => {
    describe('basic subscription', () => {
        it('should return the derived value from a single dependency', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'hello');

            const {result} = renderHook(() => useOnyxState((state) => state[ONYXKEYS.TEST_KEY], {dependencies: [ONYXKEYS.TEST_KEY]}));
            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual('hello');
        });

        it('should update when the dependency changes', async () => {
            const {result} = renderHook(() => useOnyxState((state) => state[ONYXKEYS.TEST_KEY], {dependencies: [ONYXKEYS.TEST_KEY]}));
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'updated'));

            expect(result.current).toEqual('updated');
        });

        it('should NOT re-render when a non-dependency key changes', async () => {
            let renderCount = 0;
            const {result} = renderHook(() => {
                renderCount += 1;
                return useOnyxState((state) => state[ONYXKEYS.TEST_KEY], {dependencies: [ONYXKEYS.TEST_KEY]});
            });
            await act(async () => waitForPromisesToResolve());

            const renderCountAfterMount = renderCount;

            await act(async () => Onyx.set(ONYXKEYS.OTHER_TEST, 'irrelevant'));

            expect(renderCount).toEqual(renderCountAfterMount);
            expect(result.current).toBeUndefined();
        });

        it('should re-run when any of multiple dependencies change', async () => {
            const {result} = renderHook(() =>
                useOnyxState((state) => `${state[ONYXKEYS.TEST_KEY] ?? ''}-${state[ONYXKEYS.OTHER_TEST] ?? ''}`, {dependencies: [ONYXKEYS.TEST_KEY, ONYXKEYS.OTHER_TEST]}),
            );
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'a'));
            expect(result.current).toEqual('a-');

            await act(async () => Onyx.set(ONYXKEYS.OTHER_TEST, 'b'));
            expect(result.current).toEqual('a-b');
        });
    });

    describe('collection dependency', () => {
        it('should re-run when any member of a collection dependency changes', async () => {
            const {result} = renderHook(() => useOnyxState((state) => Object.keys(state[COLLECTION] ?? {}).length, {dependencies: [COLLECTION]}));
            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual(0);

            await act(async () => Onyx.merge(MEMBER_1, {id: 1}));
            expect(result.current).toEqual(1);

            await act(async () => Onyx.merge(MEMBER_2, {id: 2}));
            expect(result.current).toEqual(2);
        });

        it('should re-run on a mergeCollection write', async () => {
            const {result} = renderHook(() => useOnyxState((state) => Object.keys(state[COLLECTION] ?? {}).length, {dependencies: [COLLECTION]}));
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {id: 1}, [MEMBER_2]: {id: 2}} as GenericCollection));

            expect(result.current).toEqual(2);
        });
    });

    describe('previousState', () => {
        it('should pass undefined as previousState on the first selector run', async () => {
            const observed: Array<OnyxStateView | undefined> = [];
            renderHook(() =>
                useOnyxState(
                    (state, previousState) => {
                        observed.push(previousState);
                        return state[ONYXKEYS.TEST_KEY];
                    },
                    {dependencies: [ONYXKEYS.TEST_KEY]},
                ),
            );
            await act(async () => waitForPromisesToResolve());

            // The very first invocation always runs before any output has been captured.
            expect(observed[0]).toBeUndefined();
        });

        it('should expose the prior dependency value through previousState after a change', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'a');

            let sawCurrentBWithPreviousA = false;
            renderHook(() =>
                useOnyxState(
                    (state, previousState) => {
                        if (state[ONYXKEYS.TEST_KEY] === 'b' && previousState?.[ONYXKEYS.TEST_KEY] === 'a') {
                            sawCurrentBWithPreviousA = true;
                        }
                        return state[ONYXKEYS.TEST_KEY];
                    },
                    {dependencies: [ONYXKEYS.TEST_KEY]},
                ),
            );
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'b'));

            expect(sawCurrentBWithPreviousA).toBeTruthy();
        });
    });

    describe('previousState-dependent output (delta selectors)', () => {
        // `previousState` is advanced post-commit, so a selector whose OUTPUT depends on it
        // is stable: within a render the previous view is frozen, so repeated getSnapshot
        // calls produce the same delta.
        it('should return a stable delta of which collection members changed since the last render', async () => {
            await Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {v: 1}, [MEMBER_2]: {v: 1}} as GenericCollection);

            const {result} = renderHook(() =>
                useOnyxState(
                    (state, previousState) => {
                        const current = (state[COLLECTION] ?? {}) as Record<string, unknown>;
                        const previous = (previousState?.[COLLECTION] ?? {}) as Record<string, unknown>;
                        return Object.keys(current)
                            .filter((memberKey) => current[memberKey] !== previous[memberKey])
                            .sort();
                    },
                    {dependencies: [COLLECTION]},
                ),
            );
            await act(async () => waitForPromisesToResolve());

            // Change only MEMBER_2 — the delta should contain exactly MEMBER_2.
            await act(async () => Onyx.merge(MEMBER_2, {v: 2}));

            expect(result.current).toEqual([MEMBER_2]);
        });

        it('should recompute the delta on each subsequent change (previousState advances per commit)', async () => {
            await Onyx.mergeCollection(COLLECTION, {[MEMBER_1]: {v: 1}, [MEMBER_2]: {v: 1}} as GenericCollection);

            const {result} = renderHook(() =>
                useOnyxState(
                    (state, previousState) => {
                        const current = (state[COLLECTION] ?? {}) as Record<string, unknown>;
                        const previous = (previousState?.[COLLECTION] ?? {}) as Record<string, unknown>;
                        return Object.keys(current)
                            .filter((memberKey) => current[memberKey] !== previous[memberKey])
                            .sort();
                    },
                    {dependencies: [COLLECTION]},
                ),
            );
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.merge(MEMBER_1, {v: 9}));
            expect(result.current).toEqual([MEMBER_1]);

            // A second, independent change must report only MEMBER_2 — proving `previousState`
            // advanced to the post-first-change snapshot rather than staying at the original.
            await act(async () => Onyx.merge(MEMBER_2, {v: 9}));
            expect(result.current).toEqual([MEMBER_2]);
        });
    });

    describe('selectorEquality', () => {
        it('should preserve the output reference when the new output is deep-equal (default equality)', async () => {
            const {result} = renderHook(() => useOnyxState((state) => ({length: ((state[ONYXKEYS.TEST_KEY] as string) ?? '').length}), {dependencies: [ONYXKEYS.TEST_KEY]}));
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'aa'));
            const referenceAfterFirstChange = result.current;
            expect(referenceAfterFirstChange).toEqual({length: 2});

            // New input, same-length string → deep-equal output → the previous reference is kept.
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'bb'));

            expect(result.current).toBe(referenceAfterFirstChange);
        });

        it('should never update after the first value when a custom equality always returns true', async () => {
            const {result} = renderHook(() =>
                useOnyxState((state) => state[ONYXKEYS.TEST_KEY] ?? 'none', {
                    dependencies: [ONYXKEYS.TEST_KEY],
                    selectorEquality: () => true,
                }),
            );
            await act(async () => waitForPromisesToResolve());

            expect(result.current).toEqual('none');

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'changed'));

            // Custom equality reports "unchanged", so the React update is skipped.
            expect(result.current).toEqual('none');
        });

        it('should update when a custom equality reports the output changed', async () => {
            const {result} = renderHook(() =>
                useOnyxState((state) => state[ONYXKEYS.TEST_KEY] ?? 'none', {
                    dependencies: [ONYXKEYS.TEST_KEY],
                    selectorEquality: (a, b) => a === b,
                }),
            );
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'changed'));

            expect(result.current).toEqual('changed');
        });
    });

    describe('re-render without a store change', () => {
        it('should not run the selector again when the component re-renders and no dependency changed', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'hello');
            const selector = jest.fn((state: OnyxStateView) => state[ONYXKEYS.TEST_KEY]);
            const {result, rerender} = renderHook((_props: {renderID: number}) => useOnyxState(selector, {dependencies: [ONYXKEYS.TEST_KEY]}), {initialProps: {renderID: 0}});
            await act(async () => waitForPromisesToResolve());
            const callCountAfterMount = selector.mock.calls.length;

            rerender({renderID: 1});
            rerender({renderID: 2});

            expect(selector).toHaveBeenCalledTimes(callCountAfterMount);
            expect(result.current).toEqual('hello');
        });

        it('should run the selector again when a re-render passes a new selector', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'hello');
            const {result, rerender} = renderHook(
                ({suffix}: {suffix: string}) => useOnyxState((state) => `${state[ONYXKEYS.TEST_KEY] as string}${suffix}`, {dependencies: [ONYXKEYS.TEST_KEY]}),
                {
                    initialProps: {suffix: '!'},
                },
            );
            await act(async () => waitForPromisesToResolve());

            rerender({suffix: '?'});

            expect(result.current).toEqual('hello?');
        });

        it('should run the selector again on a re-render after a dependency changed', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'hello');
            const selector = jest.fn((state: OnyxStateView) => state[ONYXKEYS.TEST_KEY]);
            const {result} = renderHook(() => useOnyxState(selector, {dependencies: [ONYXKEYS.TEST_KEY]}));
            await act(async () => waitForPromisesToResolve());
            const callCountAfterMount = selector.mock.calls.length;

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'updated'));

            expect(selector.mock.calls.length).toBeGreaterThan(callCountAfterMount);
            expect(result.current).toEqual('updated');
        });

        it('should still pass previousState to a selector that declares it with a default value', async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'first');
            // `Function.length` stops counting at the first defaulted parameter, so this selector reports
            // an arity of 1 even though it reads `previousState`.
            const {result} = renderHook(() =>
                useOnyxState((state, previousState = undefined) => `${state[ONYXKEYS.TEST_KEY] as string}/${(previousState?.[ONYXKEYS.TEST_KEY] as string) ?? 'none'}`, {
                    dependencies: [ONYXKEYS.TEST_KEY],
                }),
            );
            await act(async () => waitForPromisesToResolve());

            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'second'));

            expect(result.current).toEqual('second/first');
        });
    });

    describe('sharing results between instances', () => {
        it('should run a stable selector once per change for every instance that mounts it', async () => {
            // Given three components that mount the same module-level selector
            const selectTestValue = jest.fn((state: OnyxStateView) => `${state[ONYXKEYS.TEST_KEY] as string}!`);
            await Onyx.set(ONYXKEYS.TEST_KEY, 'first');
            const hooks = [1, 2, 3].map(() => renderHook(() => useOnyxState(selectTestValue, {dependencies: [ONYXKEYS.TEST_KEY]})));
            await act(async () => waitForPromisesToResolve());
            selectTestValue.mockClear();

            // When the dependency changes
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'second'));

            // Then the selector runs once and every instance gets its result
            expect(selectTestValue).toHaveBeenCalledTimes(1);
            for (const {result} of hooks) {
                expect(result.current).toEqual('second!');
            }
        });

        it('should still run an inline selector in every instance', async () => {
            // Given three components that each pass their own inline selector
            const runs = jest.fn();
            await Onyx.set(ONYXKEYS.TEST_KEY, 'first');
            for (let index = 0; index < 3; index++) {
                renderHook(() =>
                    useOnyxState(
                        (state) => {
                            runs();
                            return state[ONYXKEYS.TEST_KEY];
                        },
                        {dependencies: [ONYXKEYS.TEST_KEY]},
                    ),
                );
            }
            await act(async () => waitForPromisesToResolve());
            runs.mockClear();

            // When the dependency changes
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'second'));

            // Then nothing identifies the three selectors as the same, so each instance runs its own
            expect(runs.mock.calls.length).toBeGreaterThanOrEqual(3);
        });

        it('should not share a stable selector between different dependency lists', async () => {
            // Given the same selector mounted over two different dependency lists
            const selectBoth = jest.fn((state: OnyxStateView) => `${state[ONYXKEYS.TEST_KEY] as string}|${state[ONYXKEYS.OTHER_TEST] as string}`);
            await Onyx.set(ONYXKEYS.TEST_KEY, 'a');
            await Onyx.set(ONYXKEYS.OTHER_TEST, 'x');
            const narrow = renderHook(() => useOnyxState(selectBoth, {dependencies: [ONYXKEYS.TEST_KEY]}));
            const wide = renderHook(() => useOnyxState(selectBoth, {dependencies: [ONYXKEYS.TEST_KEY, ONYXKEYS.OTHER_TEST]}));
            await act(async () => waitForPromisesToResolve());

            // When only the key the wider list declares changes
            await act(async () => Onyx.set(ONYXKEYS.OTHER_TEST, 'y'));

            // Then the wider one sees the change, and the narrower one keeps what its own deps produced
            expect(wide.result.current).toEqual('a|y');
            expect(narrow.result.current).toEqual('a|x');
        });

        it('should not share the result of a run that read previousState', async () => {
            // Given two components that mount the same selector, which reads previousState
            const selectChange = jest.fn(
                (state: OnyxStateView, previousState: OnyxStateView | undefined) => `${previousState?.[ONYXKEYS.TEST_KEY] as string}->${state[ONYXKEYS.TEST_KEY] as string}`,
            );
            await Onyx.set(ONYXKEYS.TEST_KEY, 'first');
            renderHook(() => useOnyxState(selectChange, {dependencies: [ONYXKEYS.TEST_KEY]}));
            renderHook(() => useOnyxState(selectChange, {dependencies: [ONYXKEYS.TEST_KEY]}));
            await act(async () => waitForPromisesToResolve());
            selectChange.mockClear();

            // When the dependency changes
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'second'));

            // Then each instance runs it against its own previous state
            expect(selectChange).toHaveBeenCalledTimes(2);
        });

        it('should not hand a run made without previousState to an instance that has one', async () => {
            // Given a selector that reads previousState, mounted in A, which has seen a change
            const selectChange = (state: OnyxStateView, previousState: OnyxStateView | undefined) => `${previousState?.[ONYXKEYS.TEST_KEY] as string}->${state[ONYXKEYS.TEST_KEY] as string}`;
            await Onyx.set(ONYXKEYS.TEST_KEY, 'first');
            const a = renderHook(() => useOnyxState(selectChange, {dependencies: [ONYXKEYS.TEST_KEY]}));
            await act(async () => waitForPromisesToResolve());
            await act(async () => Onyx.set(ONYXKEYS.TEST_KEY, 'second'));

            // When B mounts with no previousState yet, and A re-renders
            const b = renderHook(() => useOnyxState(selectChange, {dependencies: [ONYXKEYS.TEST_KEY]}));
            await act(async () => waitForPromisesToResolve());
            a.rerender({});
            await act(async () => waitForPromisesToResolve());

            // Then A still diffs against its own previous state instead of taking B's result
            expect(b.result.current).toEqual('undefined->second');
            expect(a.result.current).toEqual('second->second');
        });
    });

    describe('before Onyx.init has finished', () => {
        // Providers above the app's migration gate subscribe during a cold start, before the cache has
        // been hydrated, so put Onyx back to "not initialised" for these.
        beforeEach(async () => {
            // `Onyx.clear()` waits for init, so clear storage directly before taking init away.
            await StorageMock.clear();
            resetDeferredInitTask();
        });

        afterEach(async () => {
            Onyx.init({keys: ONYXKEYS});
            await act(async () => waitForPromisesToResolve());
        });

        it('should re-run the selector once init hydrates the cache', async () => {
            // Given values already in storage and a subscriber mounted before init runs
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'from storage');
            await StorageMock.setItem(ONYXKEYS.OTHER_TEST, 'other from storage');

            const {result} = renderHook(() =>
                useOnyxState((state) => [state[ONYXKEYS.TEST_KEY], state[ONYXKEYS.OTHER_TEST]].join('|'), {
                    dependencies: [ONYXKEYS.TEST_KEY, ONYXKEYS.OTHER_TEST],
                }),
            );

            // Then the selector has only an empty state to work with, because `cache.hydrate()`
            // notifies nobody
            expect(result.current).toEqual('|');

            // When init hydrates the cache
            Onyx.init({keys: ONYXKEYS});
            await act(async () => waitForPromisesToResolve());

            // Then the selector re-runs against what was in storage, rather than being stuck on the
            // empty-state output forever
            expect(result.current).toEqual('from storage|other from storage');
        });

        it('should report the post-init values as a change against the pre-hydration previousState', async () => {
            // Given a value in storage and a selector that reports what changed since its last output
            await StorageMock.setItem(ONYXKEYS.TEST_KEY, 'from storage');

            const {result} = renderHook(() =>
                useOnyxState(
                    (state, previousState) => ({
                        previous: previousState?.[ONYXKEYS.TEST_KEY],
                        current: state[ONYXKEYS.TEST_KEY],
                    }),
                    {dependencies: [ONYXKEYS.TEST_KEY]},
                ),
            );

            // When init hydrates the cache after the first committed render
            Onyx.init({keys: ONYXKEYS});
            await act(async () => waitForPromisesToResolve());

            // Then `previousState` holds the pre-hydration value, so hydration reads as the key
            // appearing rather than as no change at all
            expect(result.current).toEqual({previous: undefined, current: 'from storage'});
        });
    });
});

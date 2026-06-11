import {useCallback, useMemo, useRef, useSyncExternalStore} from 'react';
import createMemoizedSelector from './createMemoizedSelector';
import onyxStore from './OnyxStore';
import type {OnyxKey, OnyxValue} from './types';

type UseOnyxSelector<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>> = (data: OnyxValue<TKey> | undefined) => TReturnValue;

type UseOnyxOptions<TKey extends OnyxKey, TReturnValue> = {
    /**
     * Subscribe to a subset of an Onyx key's data. The component re-renders only when
     * the selector's output reference changes; selectors that allocate fresh objects
     * (e.g. `(e) => ({id: e?.id})`) are handled by an internal input-cache + deepEqual
     * fallback so they don't cause `useSyncExternalStore` to loop.
     */
    selector?: UseOnyxSelector<TKey, TReturnValue>;
};

/**
 * The second tuple element of `useOnyx`'s result. With eager-load + the structural-sharing
 * cache there is no pending/loading phase, so there is no status to report — it is an empty
 * object. It's retained only to preserve the `[value, metadata]` tuple shape that consumers
 * destructure.
 */
type ResultMetadata = Record<string, never>;

type UseOnyxResult<TValue> = [NonNullable<TValue> | undefined, ResultMetadata];

const EMPTY_METADATA: ResultMetadata = {};

/**
 * Subscribes a React component to an Onyx key. The component re-renders when the value
 * at `key` changes (for collection keys, when any member changes — the returned value is
 * the frozen collection snapshot).
 *
 * Returns `[value, {}]`. With eager-load + the structural-sharing cache there's no loading
 * phase — the cache always has an answer (a value or "absent") — so the metadata carries no
 * status and is an empty object.
 */
function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnValue>): UseOnyxResult<TReturnValue> {
    const selector = options?.selector;

    // The memoized selector is recreated only when the selector function identity changes.
    // Inside, it caches by input reference; that's what keeps useSyncExternalStore from
    // looping when consumers pass inline-allocating selectors.
    const memoizedSelector = useMemo(() => (selector ? createMemoizedSelector(selector) : null), [selector]);

    const subscribe = useCallback((onStoreChange: () => void) => onyxStore.subscribe(key, onStoreChange), [key]);

    // resultRef holds the last tuple returned to React. We return the same tuple reference
    // when value hasn't changed so React skips the re-render.
    const resultRef = useRef<UseOnyxResult<TReturnValue>>([undefined, EMPTY_METADATA]);

    const getSnapshot = useCallback((): UseOnyxResult<TReturnValue> => {
        const raw = onyxStore.getState(key);
        const selected = memoizedSelector ? memoizedSelector(raw as OnyxValue<TKey>) : (raw as TReturnValue | undefined);
        const nextValue = (selected ?? undefined) as NonNullable<TReturnValue> | undefined;

        if (resultRef.current[0] === nextValue) {
            return resultRef.current;
        }
        resultRef.current = [nextValue, EMPTY_METADATA];
        return resultRef.current;
    }, [key, memoizedSelector]);

    return useSyncExternalStore(subscribe, getSnapshot);
}

export default useOnyx;

export type {ResultMetadata, UseOnyxResult, UseOnyxOptions, UseOnyxSelector};

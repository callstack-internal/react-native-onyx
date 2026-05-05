import {deepEqual} from 'fast-equals';
import {useCallback, useMemo, useRef, useSyncExternalStore} from 'react';
import OnyxCache, {TASK} from './OnyxCache';
import connectionManager from './OnyxConnectionManager';
import OnyxKeys from './OnyxKeys';
import OnyxUtils from './OnyxUtils';
import type {CollectionKeyBase, OnyxKey, OnyxValue} from './types';

type UseOnyxSelector<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>> = (data: OnyxValue<TKey> | undefined) => TReturnValue;

type UseOnyxOptions<TKey extends OnyxKey, TReturnValue> = {
    /**
     * If set to `false`, the connection won't be reused between other subscribers that are listening to the same Onyx key
     * with the same connect configurations.
     */
    reuseConnection?: boolean;

    /**
     * This will be used to subscribe to a subset of an Onyx key's data.
     * Using this setting on `useOnyx` can have very positive performance benefits because the component will only re-render
     * when the subset of data changes. Otherwise, any change of data on any property would normally
     * cause the component to re-render (and that can be expensive from a performance standpoint).
     * @see `useOnyx` cannot return `null` and so selector will replace `null` with `undefined` to maintain compatibility.
     */
    selector?: UseOnyxSelector<TKey, TReturnValue>;
};

type FetchStatus = 'loading' | 'loaded';

type ResultMetadata<TValue> = {
    status: FetchStatus;
    sourceValue?: NonNullable<TValue> | undefined;
};

type UseOnyxResult<TValue> = [NonNullable<TValue> | undefined, ResultMetadata<TValue>];

function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnValue>): UseOnyxResult<TReturnValue> {
    const selector = options?.selector;

    // Memoizes selector calls. Two responsibilities:
    //   1. Skip recomputation when input ref is unchanged. `useSyncExternalStore` calls
    //      `getSnapshot` multiple times per render for consistency verification — without this
    //      cache, allocating selectors (e.g. `(account) => ({id: account?.id})`) produce a new
    //      ref each call and React errors with "Maximum update depth exceeded".
    //   2. Preserve the previous output ref when a recomputation produces deep-equal content.
    //      This is what makes selectors a re-render gate: when an unrelated property of the
    //      input changes, the selected slice stays referentially stable.
    const memoizedSelector = useMemo<UseOnyxSelector<TKey, TReturnValue> | null>(() => {
        if (!selector) {
            return null;
        }

        let lastInput: OnyxValue<TKey> | undefined;
        let lastOutput: TReturnValue;
        let initialized = false;

        return (input: OnyxValue<TKey> | undefined): TReturnValue => {
            if (!initialized || lastInput !== input) {
                const next = selector(input);
                lastInput = input;
                if (!initialized || !deepEqual(lastOutput, next)) {
                    lastOutput = next;
                }
                initialized = true;
            }
            return lastOutput;
        };
    }, [selector]);

    // Tuple returned to React. Kept reference-stable when nothing meaningful changed so
    // `useSyncExternalStore` doesn't schedule unnecessary re-renders. `subscribe` resets it on
    // every new subscription (mount or key change) so key switches transition through loading.
    const resultRef = useRef<UseOnyxResult<TReturnValue>>([undefined, {status: 'loading'}]);

    // True once the connection callback has fired for the current key.
    const hasCallbackFiredRef = useRef(false);

    // True after the first `subscribe` call. Lets us skip the per-subscription state reset on
    // initial mount (refs are already in their initial state) so we don't clobber what the
    // first `getSnapshot` already produced — which would cause an extra render.
    const hasMountedRef = useRef(false);

    // Metadata carried from the connection callback into the result tuple.
    const sourceValueRef = useRef<NonNullable<TReturnValue> | undefined>(undefined);

    const getSnapshot = useCallback((): UseOnyxResult<TReturnValue> => {
        // While the first connection callback hasn't fired, the cache might be unreliable for this
        // key. We stay in 'loading' if either:
        //   - there's a queued merge for this key (the cached value is known stale), or
        //   - the cache simply has no data and no `Onyx.clear()` is in flight (clear short-circuits
        //     to 'loaded' because we know the post-clear value is `undefined`).
        const isFirstConnection = !hasCallbackFiredRef.current;
        const hasPendingMerge = OnyxUtils.hasPendingMergeForKey(key);
        const cacheReady = OnyxCache.hasCacheForKey(key) || OnyxCache.hasPendingTask(TASK.CLEAR);
        if (isFirstConnection && (hasPendingMerge || !cacheReady)) {
            return resultRef.current;
        }

        const raw = OnyxUtils.tryGetCachedValue(key) as OnyxValue<TKey>;
        const next = ((memoizedSelector ? memoizedSelector(raw) : raw) ?? undefined) as NonNullable<TReturnValue> | undefined;

        const [previous, metadata] = resultRef.current;
        if (metadata.status === 'loaded' && previous === next) {
            return resultRef.current;
        }

        resultRef.current = [next, {status: 'loaded', sourceValue: sourceValueRef.current}];
        return resultRef.current;
    }, [key, memoizedSelector]);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            // Skip the reset on initial mount so we don't undo the first `getSnapshot`'s work.
            // On re-subscriptions (key change), reset state so the hook transitions through loading.
            if (hasMountedRef.current) {
                hasCallbackFiredRef.current = false;
                sourceValueRef.current = undefined;
                resultRef.current = [undefined, {status: 'loading'}];
            }
            hasMountedRef.current = true;

            const connection = connectionManager.connect<CollectionKeyBase>({
                key,
                callback: (_value, _callbackKey, sourceValue) => {
                    hasCallbackFiredRef.current = true;
                    sourceValueRef.current = sourceValue as NonNullable<TReturnValue>;
                    onStoreChange();
                },
                waitForCollectionCallback: OnyxKeys.isCollectionKey(key) as true,
                reuseConnection: options?.reuseConnection,
            });

            return () => connectionManager.disconnect(connection);
        },
        [key, options?.reuseConnection],
    );

    return useSyncExternalStore<UseOnyxResult<TReturnValue>>(subscribe, getSnapshot);
}

export default useOnyx;

export type {FetchStatus, ResultMetadata, UseOnyxResult, UseOnyxOptions, UseOnyxSelector};

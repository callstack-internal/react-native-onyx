import {deepEqual, shallowEqual} from 'fast-equals';
import {useCallback, useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import type {DependencyList} from 'react';
import OnyxCache from './OnyxCache';
import OnyxUtils from './OnyxUtils';
import {subscribeToKeyChanges} from './OnyxKeyChangeListeners';
import * as GlobalSettings from './GlobalSettings';
import type {OnyxKey, OnyxValue} from './types';
import decorateWithMetrics from './metrics';
import onyxSnapshotCache from './OnyxSnapshotCache';
import useLiveRef from './useLiveRef';

type UseOnyxSelector<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>> = (data: OnyxValue<TKey> | undefined) => TReturnValue;

type UseOnyxOptions<TKey extends OnyxKey, TReturnValue> = {
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

function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(
    key: TKey,
    options?: UseOnyxOptions<TKey, TReturnValue>,
    dependencies: DependencyList = [],
): UseOnyxResult<TReturnValue> {
    const currentDependenciesRef = useLiveRef(dependencies);
    const selector = options?.selector;

    // Create memoized version of selector for performance
    const memoizedSelector = useMemo((): UseOnyxSelector<TKey, TReturnValue> | null => {
        if (!selector) {
            return null;
        }

        let lastInput: OnyxValue<TKey> | undefined;
        let lastOutput: TReturnValue;
        let lastDependencies: DependencyList = [];
        let hasComputed = false;

        return (input: OnyxValue<TKey> | undefined): TReturnValue => {
            const currentDependencies = currentDependenciesRef.current;

            // Recompute if input changed, dependencies changed, or first time
            const dependenciesChanged = !shallowEqual(lastDependencies, currentDependencies);
            
            if (!hasComputed || lastInput !== input || dependenciesChanged) {
                // Only proceed if we have a valid selector
                if (selector) {
                    const newOutput = selector(input);

                    // Deep equality mode: only update if output actually changed
                    if (!hasComputed || !deepEqual(lastOutput, newOutput) || dependenciesChanged) {
                        lastInput = input;
                        lastOutput = newOutput;
                        lastDependencies = [...currentDependencies];
                        hasComputed = true;
                    }
                }
            }

            return lastOutput;
        };
    }, [currentDependenciesRef, selector]);

    // Cache key for snapshot cache lookups
    const cacheKey = useMemo(
        () =>
            onyxSnapshotCache.registerConsumer({
                selector: options?.selector,
            }),
        [options?.selector],
    );

    useEffect(() => () => onyxSnapshotCache.deregisterConsumer(key, cacheKey), [key, cacheKey]);

    // Track previous dependencies to detect changes
    const previousDependenciesRef = useRef<DependencyList>([]);
    const onStoreChangeFnRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        // This effect will only run if the `dependencies` array changes. If it changes it will force the hook
        // to trigger a `getSnapshot()` update by calling the stored `onStoreChange()` function reference, thus
        // re-running the hook and returning the latest value to the consumer.

        // Deep equality check to prevent infinite loops when dependencies array reference changes
        // but content remains the same
        if (shallowEqual(previousDependenciesRef.current, dependencies)) {
            return;
        }

        previousDependenciesRef.current = dependencies;

        if (!onStoreChangeFnRef.current) {
            return;
        }

        // Invalidate cache when dependencies change so selector runs with new closure values
        onyxSnapshotCache.invalidateForKey(key);
        onStoreChangeFnRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...dependencies]);

    // Stores the previous result to enable reference-stable returns when nothing changed.
    const resultRef = useRef<UseOnyxResult<TReturnValue>>([undefined, {status: 'loading'}]);
    const previousValueRef = useRef<TReturnValue | undefined | null>(null);

    // Tracks the sourceValue (partial change data) received from the last key-change notification.
    const sourceValueRef = useRef<NonNullable<TReturnValue> | undefined>(undefined);

    // Tracks the last memoizedSelector reference that getSnapshot() has computed with.
    const lastComputedSelectorRef = useRef(memoizedSelector);

    const getSnapshot = useCallback(() => {
        // Try snapshot cache first for a fast path
        const cachedResult = onyxSnapshotCache.getCachedResult<UseOnyxResult<TReturnValue>>(key, cacheKey);
        if (cachedResult !== undefined) {
            resultRef.current = cachedResult;
            return cachedResult;
        }

        // Read directly from cache — this is always available post-init
        const rawValue = OnyxUtils.tryGetCachedValue(key) as OnyxValue<TKey>;
        const hasSelectorChanged = lastComputedSelectorRef.current !== memoizedSelector;

        const selectedValue = memoizedSelector ? memoizedSelector(rawValue) : rawValue;
        lastComputedSelectorRef.current = memoizedSelector;
        const newValue = (selectedValue ?? undefined) as TReturnValue | undefined;

        // Determine fetch status.
        // If init is done, always report 'loaded' — the cache is fully populated,
        // and any missing key genuinely doesn't exist (not still loading).
        // Only report 'loading' pre-init when cache doesn't have data yet or there's a pending merge.
        const isFirstRender = previousValueRef.current === null;
        const isInitDone = OnyxUtils.getDeferredInitTask().isResolved;
        const hasCacheForKey = OnyxCache.hasCacheForKey(key) || rawValue !== undefined;
        let fetchStatus: FetchStatus = 'loaded';
        if (!isInitDone && isFirstRender && (!hasCacheForKey || OnyxUtils.hasPendingMergeForKey(key))) {
            fetchStatus = 'loading';
        }

        // Check if the value actually changed
        let areValuesEqual: boolean;
        if (memoizedSelector) {
            areValuesEqual = (previousValueRef.current ?? undefined) === (newValue ?? undefined);
        } else {
            areValuesEqual = shallowEqual(previousValueRef.current ?? undefined, newValue);
        }

        // Always update on first render to transition from the initial 'loading' status,
        // even if the value is undefined (key genuinely doesn't exist).
        const shouldUpdateResult = isFirstRender || !areValuesEqual || hasSelectorChanged;

        if (shouldUpdateResult) {
            previousValueRef.current = newValue;
            resultRef.current = [
                newValue ?? undefined,
                {
                    status: fetchStatus,
                    sourceValue: sourceValueRef.current,
                },
            ];
        }

        if (fetchStatus !== 'loading') {
            onyxSnapshotCache.setCachedResult<UseOnyxResult<TReturnValue>>(key, cacheKey, resultRef.current);
        }

        return resultRef.current;
    }, [key, memoizedSelector, cacheKey]);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            onStoreChangeFnRef.current = onStoreChange;

            // Subscribe directly to key-change notifications — no connection manager needed.
            // For collection base keys, the listener is automatically notified when any member changes.
            const unsubscribe = subscribeToKeyChanges(key, (sourceValue) => {
                sourceValueRef.current = sourceValue as NonNullable<TReturnValue> | undefined;
                onyxSnapshotCache.invalidateForKey(key);
                onStoreChange();
            });

            // If init hasn't completed, notify when it does so hooks for non-default/non-existent
            // keys can transition from 'loading' to 'loaded'.
            const {isResolved, promise} = OnyxUtils.getDeferredInitTask();
            if (!isResolved) {
                promise.then(() => {
                    onyxSnapshotCache.invalidateForKey(key);
                    onStoreChange();
                });
            }

            return () => {
                unsubscribe();
                onStoreChangeFnRef.current = null;
            };
        },
        [key],
    );

    const getSnapshotDecorated = useMemo(() => {
        if (!GlobalSettings.isPerformanceMetricsEnabled()) {
            return getSnapshot;
        }

        return decorateWithMetrics(getSnapshot, 'useOnyx.getSnapshot');
    }, [getSnapshot]);

    return useSyncExternalStore<UseOnyxResult<TReturnValue>>(subscribe, getSnapshotDecorated);
}

export default useOnyx;

export type {FetchStatus, ResultMetadata, UseOnyxResult, UseOnyxOptions, UseOnyxSelector};

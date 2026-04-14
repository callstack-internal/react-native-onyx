import {deepEqual, shallowEqual} from 'fast-equals';
import {useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import type {DependencyList} from 'react';
import OnyxCache from './OnyxCache';
import OnyxUtils from './OnyxUtils';
import OnyxKeys from './OnyxKeys';
import OnyxKeyListeners from './OnyxKeyListeners';
import type {CollectionKeyBase, OnyxKey, OnyxValue} from './types';
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

    // Stores the previous cached value as it's necessary to compare with the new value in `getSnapshot()`.
    // We initialize it to `null` to simulate that we don't have any value from cache yet.
    const previousValueRef = useRef<TReturnValue | undefined | null>(null);

    // Stores the newest cached value in order to compare with the previous one and optimize `getSnapshot()` execution.
    const newValueRef = useRef<TReturnValue | undefined | null>(null);

    // Stores the previous result returned by the hook, containing the data from cache and the fetch status.
    const resultRef = useRef<UseOnyxResult<TReturnValue>>([undefined, {status: 'loading'}]);

    // Indicates if the hook has an active listener subscription.
    const isSubscribedRef = useRef(false);

    // Stores the `onStoreChange()` function so the dependencies effect can trigger re-evaluation.
    const onStoreChangeFnRef = useRef<(() => void) | null>(null);

    // Cache the options key to avoid regenerating it every getSnapshot call
    const cacheKey = useMemo(
        () =>
            onyxSnapshotCache.registerConsumer({
                selector: options?.selector,
            }),
        [options?.selector],
    );

    useEffect(() => () => onyxSnapshotCache.deregisterConsumer(key, cacheKey), [key, cacheKey]);

    // Track previous dependencies to prevent infinite loops
    const previousDependenciesRef = useRef<DependencyList>([]);

    useEffect(() => {
        // Deep equality check to prevent infinite loops when dependencies array reference changes
        // but content remains the same
        if (shallowEqual(previousDependenciesRef.current, dependencies)) {
            return;
        }

        previousDependenciesRef.current = dependencies;

        if (!isSubscribedRef.current || !onStoreChangeFnRef.current) {
            return;
        }

        // Invalidate cache when dependencies change so selector runs with new closure values
        onyxSnapshotCache.invalidateForKey(key);
        onStoreChangeFnRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...dependencies]);

    // Tracks the last memoizedSelector reference that getSnapshot() has computed with.
    const lastComputedSelectorRef = useRef(memoizedSelector);

    const getSnapshot = (): UseOnyxResult<TReturnValue> => {
        // Check snapshot cache for a previously computed result
        const cachedResult = onyxSnapshotCache.getCachedResult<UseOnyxResult<TReturnValue>>(key, cacheKey);
        if (cachedResult !== undefined) {
            resultRef.current = cachedResult;
            return cachedResult;
        }

        // Read value from cache and apply selector
        const value = OnyxUtils.tryGetCachedValue(key) as OnyxValue<TKey>;
        const hasSelectorChanged = lastComputedSelectorRef.current !== memoizedSelector;
        const selectedValue = memoizedSelector ? memoizedSelector(value) : value;
        lastComputedSelectorRef.current = memoizedSelector;
        newValueRef.current = (selectedValue ?? undefined) as TReturnValue | undefined;

        // Determine fetch status based on init state
        const newFetchStatus: FetchStatus = OnyxUtils.getDeferredInitTask().isResolved ? 'loaded' : 'loading';

        // Equality check: selectors use reference equality (they handle deep equality internally),
        // non-selector cases use shallow equality
        let areValuesEqual: boolean;
        if (memoizedSelector) {
            const normalizedPrevious = previousValueRef.current ?? undefined;
            const normalizedNew = newValueRef.current ?? undefined;
            areValuesEqual = normalizedPrevious === normalizedNew;
        } else {
            areValuesEqual = shallowEqual(previousValueRef.current ?? undefined, newValueRef.current);
        }

        const hasCacheForKey = OnyxCache.hasCacheForKey(key);
        const shouldUpdateResult = !areValuesEqual || hasSelectorChanged || (previousValueRef.current === null && hasCacheForKey);

        if (shouldUpdateResult) {
            previousValueRef.current = newValueRef.current;
            resultRef.current = [
                previousValueRef.current ?? undefined,
                {status: newFetchStatus},
            ];
        }

        if (newFetchStatus !== 'loading') {
            onyxSnapshotCache.setCachedResult<UseOnyxResult<TReturnValue>>(key, cacheKey, resultRef.current);
        }

        return resultRef.current;
    };

    const subscribe = (onStoreChange: () => void): (() => void) => {
        // Reset internal state for the new key
        previousValueRef.current = null;
        newValueRef.current = null;
        resultRef.current = [undefined, {status: 'loading'}];

        onStoreChangeFnRef.current = onStoreChange;
        isSubscribedRef.current = true;

        // Register with the lightweight listener system
        const unsubscribe = OnyxKeys.isCollectionKey(key)
            ? OnyxKeyListeners.subscribeToCollection(key as CollectionKeyBase, onStoreChange)
            : OnyxKeyListeners.subscribeToKey(key, onStoreChange);

        // Trigger re-evaluation when init completes so loading -> loaded transition happens
        OnyxUtils.getDeferredInitTask().promise.then(onStoreChange);

        return () => {
            unsubscribe();
            isSubscribedRef.current = false;
            onStoreChangeFnRef.current = null;
        };
    };

    const result = useSyncExternalStore<UseOnyxResult<TReturnValue>>(subscribe, getSnapshot);

    return result;
}

export default useOnyx;

export type {FetchStatus, ResultMetadata, UseOnyxResult, UseOnyxOptions, UseOnyxSelector};

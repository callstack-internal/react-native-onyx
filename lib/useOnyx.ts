import {deepEqual} from 'fast-equals';
import {useCallback, useEffect, useMemo, useRef, useSyncExternalStore} from 'react';
import {useSyncExternalStoreWithSelector} from 'use-sync-external-store/with-selector';

import type {ValueOf} from 'type-fest';
import type {OnyxKey, OnyxValue} from './types';

import cache from './OnyxCache';
import onyxSubscriptionManager from './OnyxSubscriptionManager';
import OnyxUtils from './OnyxUtils';
import * as SelectorStats from './selectorStats';

type UseOnyxSelector<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>> = (data: OnyxValue<TKey> | undefined) => TReturnValue;

type UseOnyxOptions<TKey extends OnyxKey, TReturnValue> = {
    /**
     * Select a subset of the key's data. Re-renders only when the selector's output changes by deep
     * equality, so an inline selector that allocates fresh objects/arrays each render is safe.
     */
    selector?: UseOnyxSelector<TKey, TReturnValue>;
};

/**
 * `loading` while the key's first value is still on its way: `Onyx.init` hasn't hydrated the cache yet,
 * or nothing is cached and a merge is in flight. `loaded` otherwise.
 */
type FetchStatus = 'loading' | 'loaded';

type ResultMetadata = {
    status: FetchStatus;
};

type UseOnyxResult<TValue> = [NonNullable<TValue> | undefined, ResultMetadata];

function isOnyxInitialised(): boolean {
    return OnyxUtils.getDeferredInitTask().isResolved;
}

/**
 * What can be said about a key's value, as a single value so that init finishing re-renders a
 * subscriber even when its key has no value and nothing else about it changed.
 */
const AVAILABILITY = {
    /** `Onyx.init` hasn't hydrated the cache yet, so nothing can be said about the key. */
    UNKNOWN: 0,
    /** The cache is hydrated and the key has no value. */
    ABSENT: 1,
    /** The cache is hydrated and the key has a value. */
    PRESENT: 2,
} as const;

type Availability = ValueOf<typeof AVAILABILITY>;

function getAvailability(key: OnyxKey): Availability {
    if (!isOnyxInitialised()) {
        return AVAILABILITY.UNKNOWN;
    }
    return cache.hasCacheForKey(key) ? AVAILABILITY.PRESENT : AVAILABILITY.ABSENT;
}

/**
 * Subscribes a component to an Onyx key, re-rendering when the value changes (for a collection key,
 * when any member changes; the value is the frozen collection object). Returns `[value, {status}]`,
 * `status` `loading` until the key's first value can be known.
 */
function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(key: TKey, options?: UseOnyxOptions<TKey, TReturnValue>): UseOnyxResult<TReturnValue> {
    const selector = options?.selector;

    // First-render marker for the loading gate below.
    const connectedKeyRef = useRef<OnyxKey | null>(null);

    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            const unsubscribe = onyxSubscriptionManager.subscribe(key, onStoreChange);

            // `Onyx.init` hydrates the cache without notifying anyone, so a subscriber that mounted
            // before it finished would never hear about the stored value. Re-read once init lands.
            let isActive = true;
            if (!isOnyxInitialised()) {
                OnyxUtils.getDeferredInitTask().promise.then(() => {
                    if (!isActive) {
                        return;
                    }
                    onStoreChange();
                });
            }

            return () => {
                isActive = false;
                unsubscribe();
            };
        },
        [key],
    );
    const getSnapshot = useCallback(() => onyxSubscriptionManager.getState(key) as OnyxValue<TKey> | undefined, [key]);

    // Measurement-only (expensify-issues#3041): per-instance state for selector stats.
    const statsStateRef = useRef<SelectorStats.InstanceState | null>(null);
    if (statsStateRef.current === null) {
        statsStateRef.current = SelectorStats.createInstanceState();
    }
    const statsState = statsStateRef.current;
    const isMeasuring = !!selector && SelectorStats.isEnabled();

    const select = useCallback(
        (data: OnyxValue<TKey> | undefined): TReturnValue | undefined => {
            if (!selector) {
                return (data as TReturnValue | undefined) ?? undefined;
            }
            return (isMeasuring ? SelectorStats.measureSelect(key, selector, statsState, data) : selector(data)) ?? undefined;
        },
        [selector, isMeasuring, key, statsState],
    );

    // Deep-equal only with a selector (its output may be freshly allocated); raw values are ref-stable.
    const measuredEqual = useCallback(
        (a: TReturnValue | undefined, b: TReturnValue | undefined) => SelectorStats.measureEqual(key, selector as (...args: never[]) => unknown, deepEqual, a, b),
        [key, selector],
    );
    // eslint-disable-next-line no-nested-ternary
    const isEqual = selector ? (isMeasuring ? measuredEqual : deepEqual) : undefined;

    const value = useSyncExternalStoreWithSelector<OnyxValue<TKey> | undefined, TReturnValue | undefined>(subscribe, getSnapshot, undefined, select, isEqual);

    // Reactive availability, so the first value landing re-renders even when the selector output is unchanged.
    const availability = useSyncExternalStore(subscribe, () => getAvailability(key));
    const isCached = availability === AVAILABILITY.PRESENT;

    // Loading while a first value is still on its way: init hasn't hydrated yet, or nothing is cached
    // and a merge is in flight.
    // eslint-disable-next-line react-hooks/refs
    const isLoading = !isOnyxInitialised() || (connectedKeyRef.current !== key && !isCached && OnyxUtils.hasPendingMergeForKey(key));
    const loadingStatus: FetchStatus = isLoading ? 'loading' : 'loaded';

    // Only advance the marker once a value exists, so an unrelated re-render can't end loading early.
    useEffect(() => {
        if (!isCached) {
            return;
        }
        connectedKeyRef.current = key;
    }, [isCached, key]);

    // Blank the value while loading: the pending merge isn't in cache yet.
    const result = isLoading ? undefined : (value as NonNullable<TReturnValue> | undefined);

    return useMemo<UseOnyxResult<TReturnValue>>(() => [result, {status: loadingStatus}], [result, loadingStatus]);
}

export default useOnyx;

export type {FetchStatus, ResultMetadata, UseOnyxResult, UseOnyxOptions, UseOnyxSelector};

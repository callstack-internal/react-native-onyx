/**
 * useOnyx Hook - Store-Based Approach
 *
 * KEY DIFFERENCE from KeyBased:
 * - KeyBased: Each component subscribes to specific keys (N subscriptions for N components)
 * - StoreBased: All components subscribe to the SAME store (1 subscription target)
 *
 * Benefits:
 * - Stable subscription target (always subscribing to same store object)
 * - Subscription logic stays constant in the hook
 * - Hook just listens to the store and re-renders when it changes
 * - Selector determines what data to extract (prevents unnecessary re-renders)
 */

import {useSyncExternalStore, useCallback, useMemo, useRef, useEffect} from 'react';
import OnyxStore from './OnyxStore';
import Onyx from './Onyx';
import type {OnyxKey, OnyxValue, OnyxState, Selector} from './types';

/**
 * Selector function for transforming Onyx data
 */
type UseOnyxSelector<TValue, TReturnValue> = (data: TValue | null) => TReturnValue;

/**
 * Options for useOnyx hook
 */
interface UseOnyxOptions<TValue, TReturnValue> {
    /**
     * Selector to transform the data before returning it
     * This allows components to subscribe to only a subset of the data
     */
    selector?: UseOnyxSelector<TValue, TReturnValue>;

    /**
     * If set to false, won't initialize with stored values
     */
    initWithStoredValues?: boolean;
}

/**
 * Result metadata
 */
interface ResultMetadata {
    status: 'loading' | 'loaded';
}

/**
 * Return type for useOnyx
 */
type UseOnyxResult<TValue> = [TValue | null, ResultMetadata];

/**
 * useOnyx Hook
 *
 * Subscribes to the global OnyxStore and extracts data for a specific key
 *
 * @example
 * ```tsx
 * // Basic usage
 * const [session, metadata] = useOnyx('session');
 *
 * // With selector
 * const [userId, metadata] = useOnyx('session', {
 *   selector: (session) => session?.userId
 * });
 * ```
 */
function useOnyx<TValue = OnyxValue, TReturnValue = TValue>(key: OnyxKey, options?: UseOnyxOptions<TValue, TReturnValue>): UseOnyxResult<TReturnValue> {
    const {selector, initWithStoredValues = true} = options ?? {};

    // Track if we've loaded the initial value
    const hasLoadedRef = useRef(false);

    // Load initial value from storage if needed
    useEffect(() => {
        if (initWithStoredValues && !hasLoadedRef.current) {
            hasLoadedRef.current = true;

            // Check if value is already in store
            if (!OnyxStore.hasKey(key)) {
                // Load from storage
                Onyx.get(key).then(() => {
                    // Value is now in store, re-render will happen automatically
                    // because we're subscribed to the store
                });
            }
        }
    }, [key, initWithStoredValues]);

    /**
     * Create a selector that extracts this key's value from the global state
     */
    const keySelector = useMemo((): Selector<TReturnValue | null> => {
        // Memoize the selector to avoid unnecessary recalculations
        let lastState: OnyxState | null = null;
        let lastOutput: TReturnValue | null = null;

        return (state: OnyxState) => {
            // Only recompute if state reference changed
            if (state !== lastState) {
                const value = state[key] !== undefined ? (state[key] as TValue) : null;

                // Apply user's selector if provided
                const result = selector ? selector(value) : (value as unknown as TReturnValue);

                lastState = state;
                lastOutput = result;
            }

            return lastOutput;
        };
    }, [key, selector]);

    /**
     * Subscribe function for useSyncExternalStore
     * This is STABLE - we always subscribe to the same store
     */
    const subscribe = useCallback((onStoreChange: () => void) => {
        // Subscribe to the GLOBAL store (not a specific key)
        return OnyxStore.subscribe(onStoreChange);
    }, []); // Empty deps - subscription target never changes!

    /**
     * Get snapshot function for useSyncExternalStore
     * Extracts our data from the global state using the selector
     */
    const getSnapshot = useCallback((): TReturnValue | null => {
        const state = OnyxStore.getState();
        return keySelector(state);
    }, [keySelector]);

    /**
     * Server snapshot (for SSR)
     */
    const getServerSnapshot = useCallback((): TReturnValue | null => {
        return null;
    }, []);

    // Use React's useSyncExternalStore
    // KEY POINT: We're subscribing to the SAME store for all hooks
    const data = useSyncExternalStore(
        subscribe, // Always the same function
        getSnapshot, // Changes when key or selector changes
        getServerSnapshot,
    );

    // Determine metadata
    const metadata: ResultMetadata = {
        status: hasLoadedRef.current ? 'loaded' : 'loading',
    };

    return [data, metadata];
}

export default useOnyx;
export type {UseOnyxSelector, UseOnyxOptions, ResultMetadata, UseOnyxResult};

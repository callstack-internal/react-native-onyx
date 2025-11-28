/**
 * useOnyx Hook - Proxy-Based Approach
 *
 * KEY DIFFERENCE: Uses immutable snapshots
 * - Returns a snapshot (immutable copy) of the state
 * - Automatically subscribes to changes
 * - Re-renders when subscribed data changes
 */

import {useSyncExternalStore, useCallback, useEffect, useRef} from 'react';
import {snapshot, subscribe} from './ReactiveSystem';
import Onyx, {state} from './Onyx';
import type {OnyxKey, OnyxValue} from './types';

/**
 * Selector function to extract data from state
 */
type UseOnyxSelector<TValue, TReturnValue> = (data: TValue | null) => TReturnValue;

/**
 * Options for useOnyx hook
 */
interface UseOnyxOptions<TValue, TReturnValue> {
    /**
     * Selector to transform the data before returning it
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
 * Returns an immutable snapshot of the data
 * Automatically re-renders when the data changes
 *
 * @example
 * ```tsx
 * // Basic usage
 * const [session] = useOnyx('session');
 *
 * // With selector
 * const [userId] = useOnyx('session', {
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

            // Check if value is already in state
            if (!(key in state)) {
                // Load from storage
                Onyx.get(key).then(() => {
                    // Value is now in state, re-render will happen automatically
                });
            }
        }
    }, [key, initWithStoredValues]);

    /**
     * Subscribe function for useSyncExternalStore
     * Subscribes to the global reactive state
     */
    const subscribeToState = useCallback((onStoreChange: () => void) => {
        // Subscribe to all state changes
        return subscribe(onStoreChange);
    }, []);

    /**
     * Get snapshot function for useSyncExternalStore
     * Returns an immutable snapshot of the data
     */
    const getSnapshot = useCallback((): TReturnValue | null => {
        // Get immutable snapshot of the state
        const snap = snapshot(state);

        // Extract the value for our key
        const value = (snap[key] as TValue) || null;

        // Apply selector if provided
        if (selector) {
            return selector(value);
        }

        return value as unknown as TReturnValue;
    }, [key, selector]);

    /**
     * Server snapshot (for SSR)
     */
    const getServerSnapshot = useCallback((): TReturnValue | null => {
        return null;
    }, []);

    // Use React's useSyncExternalStore
    const data = useSyncExternalStore(subscribeToState, getSnapshot, getServerSnapshot);

    // Determine metadata
    const metadata: ResultMetadata = {
        status: hasLoadedRef.current ? 'loaded' : 'loading',
    };

    return [data, metadata];
}

export default useOnyx;
export type {UseOnyxSelector, UseOnyxOptions, ResultMetadata, UseOnyxResult};

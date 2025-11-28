/**
 * useOnyx Hook - Observer-Based Approach
 *
 * KEY DIFFERENCE: Subscribes to an observable, not a raw key
 * - Components subscribe to observables
 * - Fine-grained reactivity: only re-renders when the specific observable changes
 * - Uses useSyncExternalStore for optimal React integration
 */

import {useSyncExternalStore, useCallback, useEffect, useRef} from 'react';
import Onyx from './Onyx';
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
 * Subscribes to an observable and returns its value
 * Automatically re-renders when the observable's value changes
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

    // Get the observable for this key
    const observable = Onyx.observe<TValue>(key);

    // Load initial value from storage if needed
    useEffect(() => {
        if (initWithStoredValues && !hasLoadedRef.current) {
            hasLoadedRef.current = true;

            // Check if observable already has a value
            if (observable.get() === null) {
                // Load from storage
                Onyx.get(key).catch((error) => {
                    console.error('Failed to load initial value:', error);
                });
            }
        }
    }, [key, initWithStoredValues, observable]);

    /**
     * Subscribe function for useSyncExternalStore
     * Subscribes to the specific observable for this key
     */
    const subscribeToObservable = useCallback(
        (onStoreChange: () => void) => {
            // Subscribe to this specific observable
            // This is the key difference from other prototypes:
            // We subscribe to a single observable, not all state changes
            return observable.subscribe(() => {
                onStoreChange();
            });
        },
        [observable],
    );

    /**
     * Get snapshot function for useSyncExternalStore
     * Returns the current value from the observable
     */
    const getSnapshot = useCallback((): TReturnValue | null => {
        // Get the current value from the observable
        const value = observable.get();

        // Apply selector if provided
        if (selector) {
            return selector(value);
        }

        return value as unknown as TReturnValue;
    }, [observable, selector]);

    /**
     * Server snapshot (for SSR)
     */
    const getServerSnapshot = useCallback((): TReturnValue | null => {
        return null;
    }, []);

    // Use React's useSyncExternalStore
    const data = useSyncExternalStore(subscribeToObservable, getSnapshot, getServerSnapshot);

    // Determine metadata
    const metadata: ResultMetadata = {
        status: hasLoadedRef.current || observable.get() !== null ? 'loaded' : 'loading',
    };

    return [data, metadata];
}

export default useOnyx;
export type {UseOnyxSelector, UseOnyxOptions, ResultMetadata, UseOnyxResult};

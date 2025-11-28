/**
 * Simplified useOnyx Hook
 * React hook for subscribing to Onyx data using useSyncExternalStore
 */

import {useSyncExternalStore, useCallback, useMemo, useRef} from 'react';
import Onyx from './Onyx';
import Cache from './Cache';
import type {OnyxKey, OnyxValue, Connection} from './types';

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
 * Simplified useOnyx hook
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
 *
 * // Collection member
 * const [report, metadata] = useOnyx('report_123');
 * ```
 */
function useOnyx<TValue = OnyxValue, TReturnValue = TValue>(key: OnyxKey, options?: UseOnyxOptions<TValue, TReturnValue>): UseOnyxResult<TReturnValue> {
    const {selector, initWithStoredValues = true} = options ?? {};

    // Store connection reference
    const connectionRef = useRef<Connection | null>(null);

    // Store subscribers that need to be notified
    const subscribersRef = useRef<Set<() => void>>(new Set());

    // Track loading state
    const loadingRef = useRef(!initWithStoredValues);

    // Memoized selector with caching
    const cachedSelector = useMemo(() => {
        if (!selector) {
            return (value: TValue | null) => value as unknown as TReturnValue;
        }

        let lastInput: TValue | null = null;
        let lastOutput: TReturnValue;
        let hasComputed = false;

        return (value: TValue | null): TReturnValue => {
            // Only recompute if input changed
            if (!hasComputed || lastInput !== value) {
                lastOutput = selector(value);
                lastInput = value;
                hasComputed = true;
            }
            return lastOutput;
        };
    }, [selector]);

    /**
     * Subscribe function for useSyncExternalStore
     */
    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            // Add this subscriber
            subscribersRef.current.add(onStoreChange);

            // Connect to Onyx if not already connected
            if (!connectionRef.current) {
                connectionRef.current = Onyx.connect<TValue>({
                    key,
                    callback: () => {
                        // Update loading state
                        loadingRef.current = false;

                        // Notify all React subscribers
                        subscribersRef.current.forEach((callback) => callback());
                    },
                });
            }

            // Return unsubscribe function
            return () => {
                subscribersRef.current.delete(onStoreChange);

                // If no more subscribers, disconnect from Onyx
                if (subscribersRef.current.size === 0 && connectionRef.current) {
                    Onyx.disconnect(connectionRef.current);
                    connectionRef.current = null;
                }
            };
        },
        [key],
    );

    /**
     * Get snapshot function for useSyncExternalStore
     */
    const getSnapshot = useCallback((): TReturnValue | null => {
        // Get value from cache
        const value = Cache.get(key) as TValue | null;

        // Apply selector if provided
        return cachedSelector(value);
    }, [key, cachedSelector]);

    /**
     * Server snapshot (for SSR)
     */
    const getServerSnapshot = useCallback((): TReturnValue | null => {
        return null;
    }, []);

    // Use React's useSyncExternalStore to subscribe to Onyx changes
    const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    // Determine metadata
    const metadata: ResultMetadata = {
        status: loadingRef.current ? 'loading' : 'loaded',
    };

    return [data, metadata];
}

export default useOnyx;
export type {UseOnyxSelector, UseOnyxOptions, ResultMetadata, UseOnyxResult};

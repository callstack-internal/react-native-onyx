/**
 * useOnyx Hook - Store-Based Implementation
 *
 * React hook for subscribing to Onyx data.
 * Uses useSyncExternalStore for optimal React 18 integration.
 *
 * Key differences from KeyBased:
 * - Subscribes to global store (not per-key subscriptions)
 * - Uses selectors to extract specific data
 * - All hooks share the same subscription target (stable function)
 * - More efficient when many components subscribe to same keys
 */

import {useSyncExternalStore, useMemo} from 'react';
import OnyxStore from './OnyxStore';
import type {OnyxKey, OnyxValue, StoreState} from './types';

/**
 * Hook options
 */
interface UseOnyxOptions<TValue, TReturnValue> {
    /**
     * Selector function to extract specific data from the value
     */
    selector?: (data: TValue | null) => TReturnValue;

    /**
     * Whether to initialize with stored values
     * Default: true
     */
    initWithStoredValues?: boolean;
}

/**
 * Metadata about the hook state
 */
interface UseOnyxMetadata {
    status: 'loading' | 'loaded';
}

/**
 * Check if a key is a collection key (ends with '_')
 */
function isCollectionKey(key: OnyxKey): boolean {
    return key.endsWith('_');
}

/**
 * useOnyx Hook
 *
 * Subscribe to an Onyx key and re-render when it changes.
 *
 * @param key - The Onyx key to subscribe to
 * @param options - Optional configuration
 * @returns [value, metadata] tuple
 *
 * @example
 * // Basic usage
 * const [session, metadata] = useOnyx('session');
 *
 * @example
 * // With selector
 * const [email] = useOnyx('session', {
 *   selector: (session) => session?.email
 * });
 */
function useOnyx<TValue = OnyxValue, TReturnValue = TValue>(
    key: OnyxKey,
    options?: UseOnyxOptions<TValue, TReturnValue>,
): [TReturnValue | null, UseOnyxMetadata] {
    const {selector, initWithStoredValues = true} = options ?? {};

    /**
     * Subscribe function - subscribes to the global store
     * This function is stable and doesn't change, making it efficient
     */
    const subscribe = useMemo(() => {
        return (callback: () => void) => {
            return OnyxStore.subscribe(callback);
        };
    }, []);

    /**
     * Snapshot function - gets the current value from the store
     * Uses selector if provided
     */
    const getSnapshot = useMemo(() => {
        return (): TReturnValue | null => {
            if (isCollectionKey(key)) {
                // Collection key - get all matching keys
                const collection = OnyxStore.getCollection<TValue>(key);
                const value = collection as unknown as TValue;

                if (selector) {
                    return selector(value);
                }

                return value as unknown as TReturnValue;
            }

            // Regular key
            const value = OnyxStore.get<TValue>(key);

            if (selector) {
                return selector(value);
            }

            return value as unknown as TReturnValue;
        };
    }, [key, selector]);

    /**
     * Server snapshot function (for SSR)
     */
    const getServerSnapshot = useMemo(() => {
        return (): TReturnValue | null => null;
    }, []);

    // Subscribe to the store
    const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    // Metadata
    const metadata: UseOnyxMetadata = useMemo(
        () => ({
            status: initWithStoredValues ? 'loaded' : 'loaded',
        }),
        [initWithStoredValues],
    );

    return [value, metadata];
}

export default useOnyx;

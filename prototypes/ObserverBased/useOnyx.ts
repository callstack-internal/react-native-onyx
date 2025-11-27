/**
 * useOnyx Hook - Observer-Based Implementation
 * Uses React's useSyncExternalStore for optimal integration
 */

import {useCallback, useSyncExternalStore, useRef, useEffect, useState} from 'react';
import Onyx from './Onyx';
import type {OnyxKey, OnyxValue} from './types';

interface UseOnyxOptions<TValue, TReturnValue> {
    selector?: (data: TValue | null) => TReturnValue;
    initWithStoredValues?: boolean;
}

type UseOnyxResult<TReturnValue> = [
    TReturnValue | null,
    {
        status: 'loading' | 'loaded';
    },
];

/**
 * React hook to subscribe to Onyx data using observables
 *
 * Features:
 * - Fine-grained reactivity via observables
 * - Only re-renders when observed value changes
 * - Supports selectors for partial updates
 * - Loading states for initial data fetch
 */
function useOnyx<TValue = OnyxValue, TReturnValue = TValue>(key: OnyxKey, options: UseOnyxOptions<TValue, TReturnValue> = {}): UseOnyxResult<TReturnValue> {
    const {selector, initWithStoredValues = true} = options;

    // Track loading state
    const [status, setStatus] = useState<'loading' | 'loaded'>('loading');
    const hasInitialized = useRef(false);

    // Get the observable for this key
    const observable = Onyx.getObservable<TValue>(key);

    // Subscribe function for useSyncExternalStore
    // This is called by React to set up the subscription
    const subscribe = useCallback(
        (onStoreChange: () => void) => {
            // Subscribe to the observable
            const unsubscribe = observable.observe(onStoreChange);

            // Return cleanup function
            return unsubscribe;
        },
        [observable],
    );

    // Get the current value from the observable
    const getSnapshot = useCallback((): TReturnValue | null => {
        const value = observable.get();

        // Apply selector if provided
        if (selector) {
            return selector(value);
        }

        return value as unknown as TReturnValue;
    }, [observable, selector]);

    // Server snapshot (for SSR)
    const getServerSnapshot = useCallback((): TReturnValue | null => {
        return null;
    }, []);

    // Use React's useSyncExternalStore for optimal performance
    const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    // Initialize with stored values on mount
    useEffect(() => {
        if (!initWithStoredValues || hasInitialized.current) {
            return;
        }

        hasInitialized.current = true;

        // Load from storage if not already loaded
        Onyx.get<TValue>(key)
            .then((storedValue) => {
                if (storedValue !== null) {
                    // Value loaded from storage
                    setStatus('loaded');
                } else {
                    // No value in storage, but still mark as loaded
                    setStatus('loaded');
                }
            })
            .catch((error) => {
                console.error('[useOnyx] Error loading initial value:', error);
                setStatus('loaded');
            });
    }, [key, initWithStoredValues]);

    return [
        value,
        {
            status,
        },
    ];
}

export default useOnyx;

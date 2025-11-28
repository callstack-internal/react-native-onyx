/**
 * Observable System - Inspired by Legend-state
 *
 * KEY CONCEPTS:
 * 1. Values are wrapped in Observable objects
 * 2. Components subscribe to observables, not raw keys
 * 3. Fine-grained reactivity - only subscribers of a specific observable are notified
 * 4. Observable API: .get(), .set(), .subscribe()
 */

import type {OnyxKey, OnyxValue, Listener, Observable} from './types';
import storage from './Storage';

/**
 * Create an Observable that wraps a value
 * Provides methods to get, set, merge, and subscribe to changes
 */
function createObservable<T = OnyxValue>(key: OnyxKey, initialValue: T | null = null): Observable<T> {
    // Current value
    let currentValue: T | null = initialValue;

    // Set of listeners subscribed to this specific observable
    const listeners = new Set<Listener<T>>();

    /**
     * Notify all listeners of this observable
     */
    function notifyListeners(): void {
        listeners.forEach((listener) => {
            listener(currentValue);
        });
    }

    /**
     * Deep merge helper for objects
     */
    function deepMerge(target: any, source: any): any {
        if (!target || typeof target !== 'object') {
            return source;
        }

        if (!source || typeof source !== 'object') {
            return source;
        }

        if (Array.isArray(source)) {
            return source;
        }

        const result = {...target};

        for (const key in source) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = deepMerge(target[key], source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    const observable: Observable<T> = {
        /**
         * Get the current value
         */
        get(): T | null {
            return currentValue;
        },

        /**
         * Set a new value
         * Updates storage and notifies all subscribers
         */
        async set(value: T | null): Promise<void> {
            currentValue = value;

            // Update storage
            if (value === null) {
                await storage.removeItem(key);
            } else {
                await storage.setItem(key, value);
            }

            // Notify subscribers
            notifyListeners();
        },

        /**
         * Merge changes with the existing value
         * Only works for objects
         */
        async merge(changes: Partial<T>): Promise<void> {
            if (currentValue === null) {
                // If no current value, just set the changes
                currentValue = changes as T;
            } else if (typeof currentValue === 'object' && !Array.isArray(currentValue)) {
                // For objects, do a deep merge
                currentValue = deepMerge(currentValue, changes) as T;
            } else {
                // For primitives and arrays, replace
                currentValue = changes as T;
            }

            // Update storage
            await storage.setItem(key, currentValue);

            // Notify subscribers
            notifyListeners();
        },

        /**
         * Subscribe to changes
         * Returns an unsubscribe function
         */
        subscribe(listener: Listener<T>): () => void {
            listeners.add(listener);

            return () => {
                listeners.delete(listener);
            };
        },

        /**
         * Get the key this observable is bound to
         */
        getKey(): OnyxKey {
            return key;
        },

        /**
         * Remove the value
         */
        async remove(): Promise<void> {
            currentValue = null;
            await storage.removeItem(key);
            notifyListeners();
        },
    };

    return observable;
}

/**
 * Observable registry
 * Maps keys to their observables
 */
class ObservableRegistry {
    private observables = new Map<OnyxKey, Observable>();

    /**
     * Get or create an observable for a key
     */
    getObservable<T = OnyxValue>(key: OnyxKey): Observable<T> {
        if (!this.observables.has(key)) {
            this.observables.set(key, createObservable<T>(key));
        }

        return this.observables.get(key) as Observable<T>;
    }

    /**
     * Clear all observables
     */
    clear(): void {
        this.observables.clear();
    }

    /**
     * Get all observable keys
     */
    getKeys(): OnyxKey[] {
        return Array.from(this.observables.keys());
    }
}

// Create a singleton registry
const registry = new ObservableRegistry();

export {createObservable, ObservableRegistry, registry};

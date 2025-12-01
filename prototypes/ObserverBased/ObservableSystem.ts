/**
 * Observable System - Inspired by Legend-state
 *
 * KEY CONCEPTS:
 * 1. Values are wrapped in Observable objects
 * 2. Components subscribe to observables, not raw keys
 * 3. Fine-grained reactivity - only subscribers of a specific observable are notified
 * 4. Observable API: .get(), .set(), .subscribe()
 */

import {deepEqual} from 'fast-equals';
import type {OnyxKey, OnyxValue, Listener, Observable} from './types';
import storage from './Storage';

/**
 * Check if a key is a collection key (ends with '_')
 */
function isCollectionKey(key: OnyxKey): boolean {
    return key.endsWith('_');
}

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
 * Create a Collection Observable that aggregates multiple observables
 * This watches all observables that start with the collection key prefix
 */
function createCollectionObservable<T = OnyxValue>(collectionKey: OnyxKey, registry: ObservableRegistry): Observable<Record<string, T>> {
    // Cache for the aggregated collection value
    let cachedCollection: Record<string, T> | null = null;
    let cachedCollectionData: unknown = null;

    // Set of listeners subscribed to this collection
    const listeners = new Set<Listener<Record<string, T>>>();

    // Map of subscriptions to individual observables
    const memberSubscriptions = new Map<OnyxKey, () => void>();

    /**
     * Notify all listeners when any member changes
     */
    function notifyListeners(): void {
        const collection = getCurrentCollection();
        listeners.forEach((listener) => {
            listener(collection);
        });
    }

    /**
     * Get the current aggregated collection value
     */
    function getCurrentCollection(): Record<string, T> {
        const collection: Record<string, T> = {};
        const allKeys = registry.getKeys();

        allKeys.forEach((observableKey) => {
            if (observableKey.startsWith(collectionKey) && observableKey !== collectionKey) {
                const obs = registry.getObservable(observableKey);
                const value = obs.get();
                if (value !== null) {
                    collection[observableKey] = value as T;
                }
            }
        });

        // Check if collection has actually changed using deep equality
        if (deepEqual(collection, cachedCollectionData)) {
            // Data hasn't changed, return the same reference
            return cachedCollection!;
        }

        // Data changed, update cache
        cachedCollectionData = collection;
        cachedCollection = collection;

        return collection;
    }

    /**
     * Subscribe to an observable that belongs to this collection
     */
    function subscribeToMember(memberKey: OnyxKey): void {
        if (memberSubscriptions.has(memberKey)) {
            return; // Already subscribed
        }

        const obs = registry.getObservable(memberKey);
        const unsubscribe = obs.subscribe(() => {
            // When a member changes, notify collection listeners
            notifyListeners();
        });

        memberSubscriptions.set(memberKey, unsubscribe);
    }

    /**
     * Called when a new member is added to the registry
     * Subscribes to it if we have active listeners
     */
    function onMemberAdded(memberKey: OnyxKey): void {
        // Only subscribe if we have active listeners
        if (listeners.size > 0) {
            subscribeToMember(memberKey);
            // Notify listeners about the new member
            notifyListeners();
        }
    }

    /**
     * Subscribe to all existing members
     */
    function subscribeToAllMembers(): void {
        const allKeys = registry.getKeys();
        allKeys.forEach((key) => {
            if (key.startsWith(collectionKey) && key !== collectionKey) {
                subscribeToMember(key);
            }
        });
    }

    const collectionObservable: Observable<Record<string, T>> & {onMemberAdded: (key: OnyxKey) => void} = {
        /**
         * Get the current aggregated collection value
         */
        get(): Record<string, T> | null {
            return getCurrentCollection();
        },

        /**
         * Set not supported for collections
         */
        async set(_value: Record<string, T> | null): Promise<void> {
            // To keep simplified implementation
            throw new Error('Cannot set a collection directly. Use merge or set individual members.');
        },

        /**
         * Merge changes into the collection
         * Updates individual member observables
         */
        async merge(changes: Partial<Record<string, T>>): Promise<void> {
            const promises = Object.entries(changes).map(([key, value]) => {
                const obs = registry.getObservable(key);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return obs.merge(value as any);
            });

            await Promise.all(promises);
        },

        /**
         * Subscribe to collection changes
         * Automatically subscribes to all member observables
         */
        subscribe(listener: Listener<Record<string, T>>): () => void {
            listeners.add(listener);

            // Subscribe to all existing members when first listener subscribes
            if (listeners.size === 1) {
                subscribeToAllMembers();
            }

            return () => {
                listeners.delete(listener);

                // If no more listeners, unsubscribe from all members
                if (listeners.size === 0) {
                    memberSubscriptions.forEach((unsubscribe) => unsubscribe());
                    memberSubscriptions.clear();
                }
            };
        },

        /**
         * Get the collection key
         */
        getKey(): OnyxKey {
            return collectionKey;
        },

        /**
         * Remove all members of the collection
         */
        async remove(): Promise<void> {
            const allKeys = registry.getKeys();
            const promises = allKeys
                .filter((key) => key.startsWith(collectionKey) && key !== collectionKey)
                .map((key) => {
                    const obs = registry.getObservable(key);
                    return obs.remove();
                });

            await Promise.all(promises);
        },

        /**
         * Notify that a new member was added
         */
        onMemberAdded,
    };

    return collectionObservable;
}

/**
 * Observable registry
 * Maps keys to their observables
 */
class ObservableRegistry {
    private observables = new Map<OnyxKey, Observable>();

    /**
     * Get or create an observable for a key
     * For collection keys (ending with '_'), returns a CollectionObservable
     * For regular keys, returns a standard Observable
     */
    getObservable<T = OnyxValue>(key: OnyxKey): Observable<T> {
        const isNew = !this.observables.has(key);

        if (isNew) {
            if (isCollectionKey(key)) {
                // Create a collection observable
                this.observables.set(key, createCollectionObservable<T>(key, this));
            } else {
                // Create a standard observable
                this.observables.set(key, createObservable<T>(key));

                // Notify any collection observables that this member was added
                this.notifyCollectionObservables(key);
            }
        }

        return this.observables.get(key) as Observable<T>;
    }

    /**
     * Notify collection observables when a new member is added
     */
    private notifyCollectionObservables(memberKey: OnyxKey): void {
        // Find all collection keys that this member belongs to
        this.observables.forEach((observable, collectionKey) => {
            // Check if this is a collection observable and the member belongs to it
            if (isCollectionKey(collectionKey) && memberKey.startsWith(collectionKey) && memberKey !== collectionKey) {
                // Type assertion to access onMemberAdded
                const collectionObs = observable as Observable & {onMemberAdded?: (key: OnyxKey) => void};
                if (collectionObs.onMemberAdded) {
                    collectionObs.onMemberAdded(memberKey);
                }
            }
        });
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

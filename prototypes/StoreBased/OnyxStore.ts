/**
 * OnyxStore - Global Store for Subscriber Management
 *
 * KEY DIFFERENCE from KeyBased approach:
 * - KeyBased: Each key has its own Set of subscribers
 * - StoreBased: ONE global store, all components subscribe to it, use selectors to read slices
 *
 * Architecture:
 * - Cache: Holds the actual data with LRU eviction
 * - OnyxStore: Manages subscribers, delegates data storage to Cache
 *
 * Benefits:
 * - Stable subscription target (components always subscribe to the same store object)
 * - Subscription logic in hooks stays constant
 * - Reduced number of subscription/unsubscription operations
 * - Simpler mental model (one store, many readers)
 */

import Cache from './Cache';
import type {OnyxKey, OnyxValue, OnyxState, Listener} from './types';

/**
 * OnyxStore - Global state store with subscriber management
 * Data is stored in Cache, this class manages subscriptions
 */
class OnyxStore {
    /** Set of all listeners subscribed to the store */
    private listeners: Set<Listener>;

    /** Flag to track if store has been initialized */
    private initialized: boolean;

    constructor() {
        this.listeners = new Set();
        this.initialized = false;
    }

    /**
     * Initialize the store
     */
    init(): void {
        if (this.initialized) {
            return;
        }
        this.initialized = true;
    }

    /**
     * Get the entire state object (synchronous)
     * This is what subscribers read from
     * Returns data from Cache
     */
    getState(): OnyxState {
        return Cache.getAllData();
    }

    /**
     * Get a specific key's value (synchronous)
     */
    getValue<T = OnyxValue>(key: OnyxKey): T | null {
        const value = Cache.get(key);
        return value !== undefined ? (value as T) : null;
    }

    /**
     * Set a value in the store
     * Updates cache and notifies ALL listeners
     */
    setValue(key: OnyxKey, value: OnyxValue): void {
        if (value === null || value === undefined) {
            Cache.delete(key);
        } else {
            Cache.set(key, value);
        }

        // Notify all listeners that state changed
        this.notifyListeners();
    }

    /**
     * Set multiple values at once
     * More efficient than calling setValue multiple times
     */
    setValues(updates: Record<OnyxKey, OnyxValue>): void {
        // Filter out nulls and update cache
        const filtered: Record<OnyxKey, OnyxValue> = {};
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                Cache.delete(key);
            } else {
                filtered[key] = value;
            }
        });

        // Batch update cache
        Cache.setMany(filtered);

        // Notify once after all updates
        this.notifyListeners();
    }

    /**
     * Merge a value with existing data
     */
    mergeValue<T = OnyxValue>(key: OnyxKey, changes: Partial<T> | T): void {
        const currentValue = this.getValue<T>(key);
        let newValue: T;

        if (currentValue !== null && typeof currentValue === 'object' && !Array.isArray(currentValue)) {
            // Object: shallow merge
            newValue = {...currentValue, ...changes} as T;
        } else {
            // Array or primitive: replace
            newValue = changes as T;
        }

        this.setValue(key, newValue);
    }

    /**
     * Remove a key from the store
     */
    removeValue(key: OnyxKey): void {
        Cache.delete(key);
        this.notifyListeners();
    }

    /**
     * Clear all state
     */
    clear(): void {
        Cache.clear();
        this.notifyListeners();
    }

    /**
     * Subscribe to the store
     * All subscribers listen to the SAME store object
     * They use selectors in their hooks to extract only the data they need
     *
     * Returns an unsubscribe function
     */
    subscribe(listener: Listener): () => void {
        this.listeners.add(listener);

        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
        };
    }

    /**
     * Notify all listeners that state has changed
     * Called after any state mutation
     *
     * NOTE: This notifies ALL listeners, not just ones affected by the change.
     * It's up to the listeners (via selectors in useOnyx) to determine if they need to re-render.
     */
    private notifyListeners(): void {
        this.listeners.forEach((listener) => {
            listener();
        });
    }

    /**
     * Get the number of active listeners
     */
    getListenerCount(): number {
        return this.listeners.size;
    }

    /**
     * Check if a key exists in the store
     */
    hasKey(key: OnyxKey): boolean {
        return Cache.has(key);
    }

    /**
     * Get all keys in the store
     */
    getAllKeys(): OnyxKey[] {
        return Cache.getAllKeys();
    }

    /**
     * Get collection members (keys that start with collection prefix)
     */
    getCollectionMembers(collectionKey: OnyxKey): Record<OnyxKey, OnyxValue> {
        return Cache.getCollectionMembers(collectionKey);
    }

    /**
     * Get debug info
     */
    getDebugInfo() {
        return {
            keyCount: Cache.getSize(),
            cacheSize: Cache.getSize(),
            listenerCount: this.listeners.size,
            initialized: this.initialized,
        };
    }
}

// Create and export singleton instance
const onyxStore = new OnyxStore();

export default onyxStore;

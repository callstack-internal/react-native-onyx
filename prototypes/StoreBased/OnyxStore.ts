/**
 * OnyxStore - Global Store Implementation
 *
 * Central store that holds all Onyx state in memory.
 * Inspired by Zustand's store pattern.
 *
 * Key differences from KeyBased:
 * - Single global state object (not per-key management)
 * - All listeners subscribe to the store (not per-key subscriptions)
 * - Efficient for concentrated workloads (same keys accessed frequently)
 */

import type {StoreState, StoreListener, OnyxKey, OnyxValue} from './types';

/**
 * The global store state
 */
let state: StoreState = {};

/**
 * Set of all listeners subscribed to the store
 */
const listeners = new Set<StoreListener>();

/**
 * Version number for tracking state changes
 * Increments on every mutation
 */
let version = 0;

/**
 * Cache for collection objects
 * Maps collection key to its cached object
 */
const collectionCache = new Map<OnyxKey, Record<OnyxKey, any>>();

/**
 * Get the current store state
 */
function getState(): StoreState {
    return state;
}

/**
 * Get a specific key from the store
 */
function get<T = OnyxValue>(key: OnyxKey): T | null {
    return (state[key] as T) ?? null;
}

/**
 * Set a value in the store
 */
function set(key: OnyxKey, value: OnyxValue): void {
    state[key] = value;
    version++;

    // Invalidate collection caches that include this key
    invalidateCollectionCaches(key);

    notifyListeners();
}

/**
 * Merge a value with existing data in the store
 * For objects: performs shallow merge
 * For arrays: replaces the array
 * For other types: replaces the value
 */
function merge<T = OnyxValue>(key: OnyxKey, changes: Partial<T> | T): void {
    const currentValue = state[key];

    let newValue: T;

    // Merge logic
    if (currentValue !== null && currentValue !== undefined && typeof currentValue === 'object' && !Array.isArray(currentValue)) {
        // Object: shallow merge
        newValue = {...(currentValue as object), ...(changes as object)} as T;
    } else {
        // Array or primitive: replace
        newValue = changes as T;
    }

    state[key] = newValue;
    version++;

    // Invalidate collection caches that include this key
    invalidateCollectionCaches(key);

    notifyListeners();
}

/**
 * Merge multiple keys at once (batch operation)
 */
function mergeCollection(collection: Record<OnyxKey, OnyxValue>): void {
    // Update all keys
    Object.entries(collection).forEach(([key, value]) => {
        const currentValue = state[key];

        if (currentValue !== null && currentValue !== undefined && typeof currentValue === 'object' && !Array.isArray(currentValue)) {
            // Object: shallow merge
            state[key] = {...(currentValue as object), ...(value as object)};
        } else {
            // Array or primitive: replace
            state[key] = value;
        }

        // Invalidate collection caches that include this key
        invalidateCollectionCaches(key);
    });

    // Only increment version and notify once after all updates
    version++;
    notifyListeners();
}

/**
 * Remove a key from the store
 */
function remove(key: OnyxKey): void {
    delete state[key];
    version++;

    // Invalidate collection caches that include this key
    invalidateCollectionCaches(key);

    notifyListeners();
}

/**
 * Clear the entire store
 */
function clear(): void {
    state = {};
    version++;

    // Clear collection cache
    collectionCache.clear();

    notifyListeners();
}

/**
 * Subscribe to store changes
 * Returns an unsubscribe function
 */
function subscribe(listener: StoreListener): () => void {
    listeners.add(listener);

    // Return unsubscribe function
    return () => {
        listeners.delete(listener);
    };
}

/**
 * Notify all listeners that the store has changed
 */
function notifyListeners(): void {
    listeners.forEach((listener) => listener());
}

/**
 * Get all keys in the store
 */
function getAllKeys(): OnyxKey[] {
    return Object.keys(state);
}

/**
 * Check if a key exists in the store
 */
function has(key: OnyxKey): boolean {
    return key in state;
}

/**
 * Invalidate collection caches when a key changes
 */
function invalidateCollectionCaches(key: OnyxKey): void {
    // Find all collection keys that this key belongs to
    collectionCache.forEach((_, collectionKey) => {
        if (key.startsWith(collectionKey)) {
            collectionCache.delete(collectionKey);
        }
    });
}

/**
 * Get collection members (keys that start with collectionKey)
 * Returns a cached object when the collection hasn't changed
 * Returns null if the collection is empty
 */
function getCollection<T = OnyxValue>(collectionKey: OnyxKey): Record<OnyxKey, T> | null {
    // Check if we have a cached collection
    if (collectionCache.has(collectionKey)) {
        return collectionCache.get(collectionKey) as Record<OnyxKey, T> | null;
    }

    // Build new collection object (excluding null values)
    const collection: Record<OnyxKey, T> = {};

    Object.keys(state).forEach((key) => {
        if (key.startsWith(collectionKey) && key !== collectionKey) {
            const value = state[key];
            // Exclude null values from collections
            if (value !== null) {
                collection[key] = value as T;
            }
        }
    });

    // Return null if collection is empty
    const hasMembers = Object.keys(collection).length > 0;
    const result = hasMembers ? collection : null;

    // Cache the collection object
    collectionCache.set(collectionKey, result);

    return result;
}

/**
 * Get debugging info
 */
function getDebugInfo() {
    return {
        keyCount: Object.keys(state).length,
        listenerCount: listeners.size,
        version,
    };
}

// Export the store API
const OnyxStore = {
    getState,
    get,
    set,
    merge,
    mergeCollection,
    remove,
    clear,
    subscribe,
    getAllKeys,
    has,
    getCollection,
    getDebugInfo,
};

export default OnyxStore;

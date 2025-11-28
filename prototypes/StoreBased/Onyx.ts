/**
 * Onyx API - Store-Based Implementation
 *
 * Main interface for interacting with the store-based storage system.
 *
 * Key differences from KeyBased:
 * - Uses global OnyxStore for state management
 * - All subscriptions are to the store (not per-key)
 * - Optimized for concentrated workloads (same keys accessed frequently)
 * - Collection-based storage for efficient bulk operations
 */

import OnyxStore from './OnyxStore';
import Storage from './Storage';
import Cache from './Cache';
import type {OnyxKey, OnyxValue, Connection, ConnectOptions, InitOptions} from './types';

/**
 * Connection registry to track active connections
 */
const connections = new Map<
    string,
    {
        key: OnyxKey;
        callback: (value: OnyxValue | null, key?: OnyxKey) => void;
        unsubscribe: () => void;
    }
>();

/**
 * Connection ID counter
 */
let connectionIdCounter = 0;

/**
 * Check if a key is a collection key (ends with '_')
 */
function isCollectionKey(key: OnyxKey): boolean {
    return key.endsWith('_');
}

/**
 * Initialize Onyx
 */
async function init(options: InitOptions = {}): Promise<void> {
    const {maxCachedKeysCount = 1000, keys} = options;

    // Configure cache
    if (maxCachedKeysCount > 0) {
        Cache.setMaxSize(maxCachedKeysCount);
    }

    // Load initial keys if provided
    if (keys) {
        Object.entries(keys).forEach(([key, value]) => {
            OnyxStore.set(key, value);
        });
    }

    // Load data from storage into the store
    const allKeys = await Storage.getAllKeys();
    if (allKeys.length > 0) {
        const items = await Storage.multiGet(allKeys);
        items.forEach(([key, value]) => {
            if (value !== null) {
                OnyxStore.set(key, value);
            }
        });
    }

    console.log('[Onyx] Initialized with', allKeys.length, 'keys');
}

/**
 * Get a value from the store
 */
async function get<T = OnyxValue>(key: OnyxKey): Promise<T | null> {
    // Get from store (which is already in memory)
    const value = OnyxStore.get<T>(key);

    if (value !== null) {
        return value;
    }

    // If not in store, try storage
    const storedValue = await Storage.getItem(key);
    if (storedValue !== null) {
        OnyxStore.set(key, storedValue);
        return storedValue as T;
    }

    return null;
}

/**
 * Set a value in the store and persist to storage
 */
async function set<T = OnyxValue>(key: OnyxKey, value: T): Promise<void> {
    // Update store (triggers listeners)
    OnyxStore.set(key, value);

    // Persist to storage asynchronously
    Storage.setItem(key, value).catch((error) => {
        console.error('[Onyx] Failed to persist to storage:', error);
    });
}

/**
 * Merge a value with existing data
 * For objects: performs shallow merge
 * For arrays: replaces the array
 * For other types: replaces the value
 */
async function merge<T = OnyxValue>(key: OnyxKey, changes: Partial<T> | T): Promise<void> {
    // Merge in store (triggers listeners)
    OnyxStore.merge<T>(key, changes);

    // Persist to storage asynchronously
    const newValue = OnyxStore.get(key);
    Storage.setItem(key, newValue).catch((error) => {
        console.error('[Onyx] Failed to persist to storage:', error);
    });
}

/**
 * Merge a collection of values
 * More efficient than individual merges
 */
async function mergeCollection<T = OnyxValue>(collectionKey: OnyxKey, collection: Record<OnyxKey, T>): Promise<void> {
    // Merge in store (single notification)
    OnyxStore.mergeCollection(collection);

    // Persist to storage asynchronously (batch operation)
    const items = Object.entries(collection).map(([key]) => {
        const currentValue = OnyxStore.get(key);
        return [key, currentValue] as [OnyxKey, OnyxValue];
    });

    Storage.multiSet(items).catch((error) => {
        console.error('[Onyx] Failed to persist collection to storage:', error);
    });
}

/**
 * Remove a key from the store and storage
 */
async function remove(key: OnyxKey): Promise<void> {
    // Remove from store (triggers listeners)
    OnyxStore.remove(key);

    // Remove from storage asynchronously
    Storage.removeItem(key).catch((error) => {
        console.error('[Onyx] Failed to remove from storage:', error);
    });
}

/**
 * Clear all data from store and storage
 */
async function clear(): Promise<void> {
    // Clear store (triggers listeners)
    OnyxStore.clear();

    // Clear storage asynchronously
    Storage.clear().catch((error) => {
        console.error('[Onyx] Failed to clear storage:', error);
    });

    console.log('[Onyx] Cleared all data');
}

/**
 * Connect to an Onyx key and listen for changes
 */
function connect<T = OnyxValue>(options: ConnectOptions<T>): Connection {
    const connectionId = `connection_${connectionIdCounter++}`;
    const {key, callback} = options;

    // Create a listener that filters for the specific key
    const listener = () => {
        if (isCollectionKey(key)) {
            // Collection key - get all matching keys
            const collection = OnyxStore.getCollection(key);
            // @ts-expect-error expected
            callback(collection as T, key);
        } else {
            // Regular key
            const value = OnyxStore.get<T>(key);
            // @ts-expect-error expected
            callback(value, key);
        }
    };

    // Subscribe to the store
    const unsubscribe = OnyxStore.subscribe(listener);

    // Store connection info
    connections.set(connectionId, {
        key,
        // @ts-expect-error expected
        callback,
        unsubscribe,
    });

    // Call callback with initial value
    listener();

    return {id: connectionId};
}

/**
 * Disconnect from an Onyx key
 */
function disconnect(connection: Connection): void {
    const connectionInfo = connections.get(connection.id);

    if (connectionInfo) {
        connectionInfo.unsubscribe();
        connections.delete(connection.id);
    }
}

/**
 * Get all keys from the store
 */
async function getAllKeys(): Promise<OnyxKey[]> {
    return OnyxStore.getAllKeys();
}

/**
 * Get debugging info
 */
function getDebugInfo() {
    return {
        ...OnyxStore.getDebugInfo(),
        connectionCount: connections.size,
        cacheStats: Cache.getStats(),
    };
}

// Export the Onyx API
const Onyx = {
    init,
    get,
    set,
    merge,
    mergeCollection,
    remove,
    clear,
    connect,
    disconnect,
    getAllKeys,
    getDebugInfo,
};

export default Onyx;

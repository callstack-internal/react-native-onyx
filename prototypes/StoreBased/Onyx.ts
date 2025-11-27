/**
 * Onyx API - Store-Based Approach
 *
 * Same API as KeyBased approach, but different internals:
 * - Storage: Collection-based (collections stored as single entries)
 * - OnyxStore: Global store with single subscription target
 * - Components: Subscribe to store, use selectors to read slices
 */

import Storage, {isCollectionKey, getCollectionKey} from './Storage';
import OnyxStore from './OnyxStore';
import Cache from './Cache';
import type {OnyxKey, OnyxValue, Connection, ConnectOptions, InitOptions, Callback} from './types';

/**
 * For non-React subscribers (Onyx.connect)
 * Maps connection IDs to their callbacks and keys
 */
const connections = new Map<string, {key: OnyxKey; callback: Callback; unsubscribe: () => void}>();
let nextConnectionId = 1;

/**
 * Initialize Onyx
 */
async function init(options: InitOptions = {}): Promise<void> {
    const {maxCachedKeysCount = 1000} = options;

    // Configure cache
    if (maxCachedKeysCount > 0) {
        Cache.setMaxSize(maxCachedKeysCount);
    }

    // Initialize the store
    OnyxStore.init();

    console.log('[Onyx StoreBased] Initialized with cache size:', maxCachedKeysCount);
}

/**
 * Get a value from storage (async)
 * First checks OnyxStore (in-memory), then falls back to Storage if not found
 */
async function get<T = OnyxValue>(key: OnyxKey): Promise<T | null> {
    // Check in-memory store first
    const storeValue = OnyxStore.getValue<T>(key);
    if (storeValue !== null) {
        return storeValue;
    }

    // Load from persistent storage
    const value = await Storage.getItem(key);

    // Update store if found
    if (value !== null) {
        OnyxStore.setValue(key, value);
    }

    return value as T;
}

/**
 * Set a value
 * Updates both OnyxStore (in-memory) and Storage (persistent)
 */
async function set<T = OnyxValue>(key: OnyxKey, value: T): Promise<void> {
    // Update in-memory store (this notifies all subscribers)
    OnyxStore.setValue(key, value);

    // Persist to storage
    await Storage.setItem(key, value);
}

/**
 * Merge a value with existing data
 */
async function merge<T = OnyxValue>(key: OnyxKey, changes: Partial<T> | T): Promise<void> {
    // Get current value (from store or storage)
    const currentValue = await get<T>(key);

    let newValue: T;

    // Merge logic
    if (currentValue !== null && typeof currentValue === 'object' && !Array.isArray(currentValue)) {
        // Object: shallow merge
        newValue = {...currentValue, ...changes} as T;
    } else {
        // Array or primitive: replace
        newValue = changes as T;
    }

    // Set the new value
    await set(key, newValue);
}

/**
 * Merge collection - set multiple collection members at once
 * This is much more efficient with collection-based storage
 */
async function mergeCollection<T = OnyxValue>(collectionKey: OnyxKey, collection: Record<OnyxKey, Partial<T> | T>): Promise<void> {
    // Load each member, merge, and collect updates
    const updates: Record<OnyxKey, T> = {};

    for (const [key, changes] of Object.entries(collection)) {
        const currentValue = await get<T>(key);

        if (currentValue !== null && typeof currentValue === 'object' && !Array.isArray(currentValue)) {
            updates[key] = {...currentValue, ...changes} as T;
        } else {
            updates[key] = changes as T;
        }
    }

    // Update store (notifies subscribers once)
    OnyxStore.setValues(updates);

    // Persist to storage (single write for entire collection)
    await Storage.setCollectionMembers(collectionKey, updates);
}

/**
 * Remove a key
 */
async function remove(key: OnyxKey): Promise<void> {
    // Remove from store
    OnyxStore.removeValue(key);

    // Remove from storage
    await Storage.removeItem(key);
}

/**
 * Clear all data
 */
async function clear(): Promise<void> {
    // Clear store
    OnyxStore.clear();

    // Clear storage
    await Storage.clear();

    console.log('[Onyx StoreBased] Cleared all data');
}

/**
 * Connect to an Onyx key (non-React)
 * Creates a subscription that listens to the global store
 */
function connect<T = OnyxValue>(options: ConnectOptions<T>): Connection {
    const {key, callback} = options;
    const connectionId = `conn_${nextConnectionId++}`;

    // Track the last value to avoid unnecessary callbacks
    let lastValue: T | null = null;

    // Subscribe to the global store
    const unsubscribe = OnyxStore.subscribe(() => {
        // When store changes, check if our key changed
        const newValue = OnyxStore.getValue<T>(key);

        // Only call callback if value actually changed
        if (newValue !== lastValue) {
            lastValue = newValue;
            callback(newValue, key);
        }
    });

    // Store connection metadata
    connections.set(connectionId, {key, callback, unsubscribe});

    // Initialize with current value
    get<T>(key).then((value) => {
        lastValue = value;
        callback(value, key);
    });

    return {id: connectionId};
}

/**
 * Disconnect from an Onyx key
 */
function disconnect(connection: Connection): void {
    const conn = connections.get(connection.id);
    if (conn) {
        conn.unsubscribe();
        connections.delete(connection.id);
    }
}

/**
 * Get all keys
 */
async function getAllKeys(): Promise<OnyxKey[]> {
    return Storage.getAllKeys();
}

/**
 * Get debugging info
 */
function getDebugInfo() {
    return {
        ...OnyxStore.getDebugInfo(),
        connectionCount: connections.size,
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

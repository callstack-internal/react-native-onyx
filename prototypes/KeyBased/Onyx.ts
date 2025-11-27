/**
 * Simplified Onyx API
 * Main interface for interacting with the key-based storage system
 */

import Storage from './Storage';
import Cache from './Cache';
import ConnectionManager from './ConnectionManager';
import type {OnyxKey, OnyxValue, Connection, ConnectOptions, InitOptions, Callback} from './types';

/**
 * Map to track subscribers for each key
 */
const subscribers = new Map<OnyxKey, Set<Callback>>();

/**
 * Check if a key is a collection key (ends with '_')
 */
function isCollectionKey(key: OnyxKey): boolean {
    return key.endsWith('_');
}

/**
 * Check if a key belongs to a collection
 */
function isCollectionMemberKey(key: OnyxKey, collectionKey: OnyxKey): boolean {
    return key.startsWith(collectionKey) && key !== collectionKey;
}

/**
 * Notify all subscribers about a key change
 */
function notifySubscribers(key: OnyxKey, value: OnyxValue | null): void {
    // Notify exact key subscribers
    const keySubscribers = subscribers.get(key);
    if (keySubscribers) {
        keySubscribers.forEach((callback) => callback(value, key));
    }

    // Notify collection subscribers if this key is part of a collection
    subscribers.forEach((callbacks, subscribedKey) => {
        if (isCollectionKey(subscribedKey) && isCollectionMemberKey(key, subscribedKey)) {
            callbacks.forEach((callback) => callback(value, key));
        }
    });
}

/**
 * Subscribe to a key
 */
function subscribeToKey(key: OnyxKey, callback: Callback): void {
    if (!subscribers.has(key)) {
        subscribers.set(key, new Set());
    }
    subscribers.get(key)!.add(callback);
}

/**
 * Unsubscribe from a key
 */
function unsubscribeFromKey(key: OnyxKey, callback: Callback): void {
    const keySubscribers = subscribers.get(key);
    if (keySubscribers) {
        keySubscribers.delete(callback);
        if (keySubscribers.size === 0) {
            subscribers.delete(key);
        }
    }
}

/**
 * Initialize Onyx
 */
async function init(options: InitOptions = {}): Promise<void> {
    const {maxCachedKeysCount = 1000} = options;

    // Configure cache
    if (maxCachedKeysCount > 0) {
        Cache.setMaxSize(maxCachedKeysCount);
    }

    // Wire up ConnectionManager to use our subscription system
    ConnectionManager.setSubscriptionHandler((key, callback) => {
        subscribeToKey(key, callback);
    });

    console.log('[Onyx] Initialized');
}

/**
 * Get a value from storage
 */
async function get<T = OnyxValue>(key: OnyxKey): Promise<T | null> {
    // Check cache first
    const cachedValue = Cache.get(key);
    if (cachedValue !== undefined) {
        return cachedValue as T;
    }

    // Fetch from storage
    const value = await Storage.getItem(key);

    // Update cache
    if (value !== null) {
        Cache.set(key, value);
    }

    return value as T;
}

/**
 * Set a value in storage
 */
async function set<T = OnyxValue>(key: OnyxKey, value: T): Promise<void> {
    // Update cache
    Cache.set(key, value);

    // Update storage
    await Storage.setItem(key, value);

    // Notify subscribers
    notifySubscribers(key, value);
}

/**
 * Merge a value with existing data
 * For objects: performs shallow merge
 * For arrays: replaces the array
 * For other types: replaces the value
 */
async function merge<T = OnyxValue>(key: OnyxKey, changes: Partial<T> | T): Promise<void> {
    // Get current value
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
 * Merge a collection of values
 */
async function mergeCollection<T = OnyxValue>(collectionKey: OnyxKey, collection: Record<OnyxKey, T>): Promise<void> {
    const promises = Object.entries(collection).map(([key, value]) => {
        return merge(key, value);
    });

    await Promise.all(promises);
}

/**
 * Remove a key from storage
 */
async function remove(key: OnyxKey): Promise<void> {
    // Remove from cache
    Cache.delete(key);

    // Remove from storage
    await Storage.removeItem(key);

    // Notify subscribers with null
    notifySubscribers(key, null);
}

/**
 * Clear all data
 */
async function clear(): Promise<void> {
    // Clear cache
    Cache.clear();

    // Clear storage
    await Storage.clear();

    // Refresh connection manager session
    ConnectionManager.refreshSessionID();

    console.log('[Onyx] Cleared all data');
}

/**
 * Connect to an Onyx key and listen for changes
 */
function connect<T = OnyxValue>(options: ConnectOptions<T>): Connection {
    const connection = ConnectionManager.connect(options);

    // Initialize with current value
    get(options.key).then((value) => {
        if (ConnectionManager.getConnectionCount() > 0) {
            options.callback(value as T, options.key);
        }
    });

    return connection;
}

/**
 * Disconnect from an Onyx key
 */
function disconnect(connection: Connection): void {
    ConnectionManager.disconnect(connection);
}

/**
 * Get all keys from storage
 */
async function getAllKeys(): Promise<OnyxKey[]> {
    return Storage.getAllKeys();
}

/**
 * Get debugging info
 */
function getDebugInfo() {
    return {
        cacheSize: Cache.getSize(),
        connectionCount: ConnectionManager.getConnectionCount(),
        subscriberCount: subscribers.size,
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

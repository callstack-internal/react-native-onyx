/**
 * Onyx API - Proxy-Based Approach
 *
 * KEY DIFFERENCE: Mutable state with automatic change detection
 * - No explicit set() or merge() calls needed
 * - Just mutate the state object directly
 * - Proxies automatically detect changes and notify subscribers
 *
 * Similar to: Valtio
 */

import {proxy, snapshot, subscribe} from './ReactiveSystem';
import Storage from './Storage';
import type {OnyxKey, OnyxValue, Connection, ConnectOptions, InitOptions, Callback} from './types';

/**
 * The global reactive state object
 * Mutate this directly - changes are automatically detected!
 */
const state = proxy<Record<OnyxKey, OnyxValue>>({});

/**
 * For non-React subscribers (Onyx.connect)
 */
const connections = new Map<string, {key: OnyxKey; callback: Callback; unsubscribe: () => void}>();
let nextConnectionId = 1;

/**
 * Initialize Onyx
 */
async function init(options: InitOptions = {}): Promise<void> {
    console.log('[Onyx ProxyBased] Initialized');
    console.log('[Onyx ProxyBased] Tip: Mutate state directly! e.g., state.session = {...}');
}

/**
 * Get a value (loads from storage if not in state)
 */
async function get<T = OnyxValue>(key: OnyxKey): Promise<T | null> {
    // Check in-memory state first
    if (key in state) {
        return state[key] as T;
    }

    // Load from storage
    const value = await Storage.getItem(key);

    // Add to state if found
    if (value !== null) {
        state[key] = value;
    }

    return value as T;
}

/**
 * Set a value (for compatibility - prefer direct mutation)
 * This persists to storage
 */
async function set<T = OnyxValue>(key: OnyxKey, value: T): Promise<void> {
    // Update state (triggers reactivity automatically)
    state[key] = value;

    // Persist to storage
    await Storage.setItem(key, value);
}

/**
 * Merge a value (for compatibility - prefer direct mutation)
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

    // Set the new value (which persists)
    await set(key, newValue);
}

/**
 * Merge collection (for compatibility)
 */
async function mergeCollection<T = OnyxValue>(collectionKey: OnyxKey, collection: Record<OnyxKey, Partial<T> | T>): Promise<void> {
    const promises = Object.entries(collection).map(([key, value]) => {
        return merge(key, value);
    });

    await Promise.all(promises);
}

/**
 * Remove a key
 */
async function remove(key: OnyxKey): Promise<void> {
    // Remove from state
    delete state[key];

    // Remove from storage
    await Storage.removeItem(key);
}

/**
 * Clear all data
 */
async function clear(): Promise<void> {
    // Clear state
    Object.keys(state).forEach((key) => {
        delete state[key];
    });

    // Clear storage
    await Storage.clear();

    console.log('[Onyx ProxyBased] Cleared all data');
}

/**
 * Connect to an Onyx key (non-React)
 * For React, use useOnyx hook
 */
function connect<T = OnyxValue>(options: ConnectOptions<T>): Connection {
    const {key, callback} = options;
    const connectionId = `conn_${nextConnectionId++}`;

    // Track the last value to avoid unnecessary callbacks
    let lastValue: T | null = null;

    // Subscribe to state changes
    const unsubscribe = subscribe(() => {
        // When state changes, check if our key changed
        const newValue = (state[key] as T) || null;

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
        stateKeys: Object.keys(state).length,
        connectionCount: connections.size,
    };
}

// Export the Onyx API
const Onyx = {
    // The reactive state object - mutate this directly!
    state,

    // Initialization
    init,

    // Compatibility methods (prefer direct mutation)
    get,
    set,
    merge,
    mergeCollection,
    remove,
    clear,

    // Subscriptions
    connect,
    disconnect,

    // Utilities
    getAllKeys,
    getDebugInfo,
};

export default Onyx;
export {state};

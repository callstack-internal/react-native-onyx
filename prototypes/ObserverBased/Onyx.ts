/**
 * Onyx API - Observer-Based Approach
 *
 * KEY DIFFERENCE: Returns observables instead of raw values
 * - Onyx.observe(key) returns an Observable object
 * - Components subscribe to observables, not keys
 * - Fine-grained reactivity: only subscribers of a specific observable are notified
 */

import type {OnyxKey, OnyxValue, InitOptions, Observable, ConnectOptions, Connection} from './types';
import {registry} from './ObservableSystem';
import storage from './Storage';

/**
 * Connection ID generator
 */
let nextConnectionId = 0;
function generateConnectionId(): string {
    return `connection_${nextConnectionId++}`;
}

/**
 * Active connections for disconnect functionality
 */
const connections = new Map<string, () => void>();

/**
 * Onyx API
 */
const Onyx = {
    /**
     * Initialize Onyx
     */
    async init(options?: InitOptions): Promise<void> {
        // Clear existing state
        registry.clear();

        // Initialize with initial keys if provided
        if (options?.keys) {
            for (const [key, value] of Object.entries(options.keys)) {
                const observable = registry.getObservable(key);
                await observable.set(value);
            }
        }
    },

    /**
     * Get an observable for a key
     * This is the main API - components get observables and subscribe to them
     *
     * @example
     * const sessionObservable = Onyx.observe('session');
     * const session = sessionObservable.get();
     * sessionObservable.set({ userId: '123' });
     */
    observe<T = OnyxValue>(key: OnyxKey): Observable<T> {
        return registry.getObservable<T>(key);
    },

    /**
     * Get a value from storage (async)
     * Loads from storage and updates the observable
     */
    async get<T = OnyxValue>(key: OnyxKey): Promise<T | null> {
        const observable = registry.getObservable<T>(key);

        // Check if observable already has a value
        const currentValue = observable.get();
        if (currentValue !== null) {
            return currentValue;
        }

        // Load from storage
        const value = (await storage.getItem(key)) as T | null;

        // Update observable without triggering notifications
        // (We don't notify because this is an initial load)
        if (value !== null) {
            await observable.set(value);
        }

        return value;
    },

    /**
     * Set a value
     * Convenience method - delegates to the observable
     */
    async set<T = OnyxValue>(key: OnyxKey, value: T | null): Promise<void> {
        const observable = registry.getObservable<T>(key);
        await observable.set(value);
    },

    /**
     * Merge changes with existing value
     * Convenience method - delegates to the observable
     */
    async merge<T = OnyxValue>(key: OnyxKey, changes: Partial<T>): Promise<void> {
        const observable = registry.getObservable<T>(key);
        await observable.merge(changes);
    },

    /**
     * Merge collection
     * Updates multiple keys that belong to a collection
     */
    async mergeCollection(collection: Record<string, any>): Promise<void> {
        const promises = Object.entries(collection).map(([key, value]) => {
            const observable = registry.getObservable(key);
            return observable.merge(value);
        });

        await Promise.all(promises);
    },

    /**
     * Remove a value
     * Convenience method - delegates to the observable
     */
    async remove(key: OnyxKey): Promise<void> {
        const observable = registry.getObservable(key);
        await observable.remove();
    },

    /**
     * Clear all data
     */
    async clear(): Promise<void> {
        await storage.clear();

        // Clear all observables and notify subscribers
        const keys = registry.getKeys();
        for (const key of keys) {
            const observable = registry.getObservable(key);
            await observable.set(null);
        }

        registry.clear();
    },

    /**
     * Connect to changes (non-React)
     * This is for backwards compatibility with the key-based API
     *
     * @example
     * const connection = Onyx.connect({
     *   key: 'session',
     *   callback: (value) => console.log('Session changed:', value)
     * });
     */
    connect<T = OnyxValue>(options: ConnectOptions<T>): Connection {
        const {key, callback} = options;
        const observable = registry.getObservable<T>(key);

        // Subscribe to the observable
        const unsubscribe = observable.subscribe((value) => {
            callback(value, key);
        });

        // Generate connection ID
        const connectionId = generateConnectionId();
        connections.set(connectionId, unsubscribe);

        // Call callback with initial value
        const initialValue = observable.get();
        callback(initialValue, key);

        return {id: connectionId};
    },

    /**
     * Disconnect a connection
     */
    disconnect(connection: Connection): void {
        const unsubscribe = connections.get(connection.id);
        if (unsubscribe) {
            unsubscribe();
            connections.delete(connection.id);
        }
    },
};

export default Onyx;
export {registry};

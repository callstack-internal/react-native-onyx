/**
 * Observer-Based Onyx Implementation
 * Main API inspired by Legend-State's observable pattern
 */

import Storage from './Storage';
import {observable, batch, clearAllObservables} from './ObservableSystem';
import type {OnyxKey, OnyxValue, InitOptions, ConnectOptions, Connection} from './types';

// Map to store all observables by key
const observables = new Map<OnyxKey, ReturnType<typeof observable>>();

// Connection tracking
let connectionIdCounter = 0;
const connections = new Map<string, () => void>();

/**
 * Get or create an observable for a key
 */
function getObservable<T = OnyxValue>(key: OnyxKey): ReturnType<typeof observable<T>> {
    if (!observables.has(key)) {
        observables.set(key, observable<T>(key));
    }
    return observables.get(key) as ReturnType<typeof observable<T>>;
}

/**
 * Check if a key is a collection key (ends with '_')
 */
function isCollectionKey(key: OnyxKey): boolean {
    return key.endsWith('_');
}

/**
 * Check if a key belongs to a collection
 */
function isCollectionMember(key: OnyxKey, collectionKey: OnyxKey): boolean {
    return key.startsWith(collectionKey) && key !== collectionKey;
}

const Onyx = {
    /**
     * Initialize Onyx
     */
    async init(options: InitOptions = {}): Promise<void> {
        console.log('[Onyx ObserverBased] Initialized');

        // Load initial keys if provided
        if (options.keys) {
            for (const [key, value] of Object.entries(options.keys)) {
                await this.set(key, value);
            }
        }
    },

    /**
     * Set a value in Onyx
     * Updates the observable and persists to storage
     */
    async set<T = OnyxValue>(key: OnyxKey, value: T): Promise<void> {
        const obs = getObservable<T>(key);
        obs.set(value);
        await Storage.setItem(key, value);
    },

    /**
     * Get a value from Onyx
     * First checks observable, then falls back to storage
     */
    async get<T = OnyxValue>(key: OnyxKey): Promise<T | null> {
        const obs = getObservable<T>(key);
        let value = obs.peek(); // Use peek to not track this access

        // If not in observable, try loading from storage
        if (value === null) {
            value = (await Storage.getItem(key)) as T | null;
            if (value !== null) {
                obs.set(value);
            }
        }

        return value;
    },

    /**
     * Merge changes into existing data
     * For objects: shallow merge
     * For arrays/primitives: replace
     */
    async merge<T = OnyxValue>(key: OnyxKey, changes: Partial<T>): Promise<void> {
        const existingValue = await this.get<T>(key);

        let newValue: T;

        if (existingValue && typeof existingValue === 'object' && !Array.isArray(existingValue)) {
            // Shallow merge for objects
            newValue = {...existingValue, ...changes} as T;
        } else {
            // Replace for arrays/primitives
            newValue = changes as T;
        }

        await this.set(key, newValue);
    },

    /**
     * Merge multiple collection members at once
     * More efficient than individual merge calls
     */
    async mergeCollection(collectionKey: OnyxKey, collection: Record<string, OnyxValue>): Promise<void> {
        // Use batch to group all updates together
        batch(() => {
            Object.entries(collection).forEach(([key, value]) => {
                const obs = getObservable(key);
                obs.set(value);
            });
        });

        // Persist all to storage
        await Promise.all(Object.entries(collection).map(([key, value]) => Storage.setItem(key, value)));
    },

    /**
     * Remove a key from Onyx
     */
    async remove(key: OnyxKey): Promise<void> {
        const obs = getObservable(key);
        obs.set(null);
        await Storage.removeItem(key);
    },

    /**
     * Clear all data
     */
    async clear(): Promise<void> {
        // Clear all observables
        observables.forEach((obs) => obs.set(null));
        observables.clear();
        clearAllObservables();

        // Clear storage
        await Storage.clear();

        console.log('[Onyx ObserverBased] Cleared all data');
    },

    /**
     * Connect to Onyx data (non-React)
     * Returns a connection object that can be used to disconnect
     */
    connect<T = OnyxValue>(options: ConnectOptions<T>): Connection {
        const {key, callback} = options;
        const obs = getObservable<T>(key);

        // Create observer that calls the callback
        const observer = () => {
            const value = obs.peek(); // Use peek to not create circular dependency
            callback(value, key);
        };

        // Subscribe to observable
        const unsubscribe = obs.observe(observer);

        // Initial call with current value
        this.get<T>(key).then((value) => {
            callback(value, key);
        });

        // Generate connection ID
        const connectionId = `connection_${++connectionIdCounter}`;
        connections.set(connectionId, unsubscribe);

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

    /**
     * Get the observable for a key (for advanced usage)
     * This allows direct access to the observable API
     */
    getObservable<T = OnyxValue>(key: OnyxKey): ReturnType<typeof observable<T>> {
        return getObservable<T>(key);
    },
};

export default Onyx;

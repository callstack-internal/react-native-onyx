/**
 * Observer-Based Onyx Types
 * Inspired by Legend-state: Components subscribe to observables, not raw keys
 */

type OnyxKey = string;

type OnyxValue = unknown;

type Callback<T = OnyxValue> = (value: T | null, key?: OnyxKey) => void;

type Connection = {
    id: string;
};

type InitOptions = {
    keys?: Record<string, unknown>;
    maxCachedKeysCount?: number;
};

type StorageProvider = {
    getItem(key: OnyxKey): Promise<OnyxValue | null>;
    setItem(key: OnyxKey, value: OnyxValue): Promise<void>;
    removeItem(key: OnyxKey): Promise<void>;
    getAllKeys(): Promise<OnyxKey[]>;
    clear(): Promise<void>;
};

type ConnectOptions<T = OnyxValue> = {
    key: OnyxKey;
    callback: Callback<T>;
};

/**
 * Observer-specific types
 */

type Listener<T = OnyxValue> = (value: T | null) => void;

/**
 * Observable interface
 * Wraps a value and provides methods to get, set, and subscribe
 */
interface Observable<T = OnyxValue> {
    /**
     * Get the current value
     */
    get(): T | null;

    /**
     * Set a new value
     */
    set(value: T | null): Promise<void>;

    /**
     * Merge changes with the existing value
     */
    merge(changes: Partial<T>): Promise<void>;

    /**
     * Subscribe to changes
     * Returns an unsubscribe function
     */
    subscribe(listener: Listener<T>): () => void;

    /**
     * Get the key this observable is bound to
     */
    getKey(): OnyxKey;

    /**
     * Remove the value
     */
    remove(): Promise<void>;
}

export type {OnyxKey, OnyxValue, Callback, Connection, InitOptions, StorageProvider, ConnectOptions, Listener, Observable};

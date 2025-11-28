/**
 * Simplified Onyx Types
 * This is a prototype implementation focusing on key-based storage
 */

// Type for any Onyx key (string)
type OnyxKey = string;

// Type for any Onyx value
type OnyxValue = unknown;

// Callback function types
type Callback<T = OnyxValue> = (value: T | null, key?: OnyxKey) => void;
type CollectionCallback<T = OnyxValue> = (collection: Record<OnyxKey, T>) => void;

// Connection options
type ConnectOptions<T = OnyxValue> = {
    key: OnyxKey;
    callback: Callback<T> | CollectionCallback<T>;
    waitForCollectionCallback?: boolean;
};

// Connection object returned by connect
type Connection = {
    id: string;
    callbackID: string;
};

// Init options
type InitOptions = {
    keys?: Record<string, unknown>;
    maxCachedKeysCount?: number;
};

// Storage provider
type StorageProvider = {
    getItem(key: OnyxKey): Promise<OnyxValue | null>;
    setItem(key: OnyxKey, value: OnyxValue): Promise<void>;
    removeItem(key: OnyxKey): Promise<void>;
    getAllKeys(): Promise<OnyxKey[]>;
    clear(): Promise<void>;
};

export type {OnyxValue, OnyxKey, Callback, CollectionCallback, ConnectOptions, Connection, InitOptions, StorageProvider};

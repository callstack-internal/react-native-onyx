/**
 * Store-Based Onyx Types
 * Single global store approach
 */

// Type for any Onyx key (string)
export type OnyxKey = string;

// Type for any Onyx value
export type OnyxValue = unknown;

// Type for collection keys (keys ending with '_')
export type CollectionKey = string;

// The global state shape - maps keys to values
export type OnyxState = Record<OnyxKey, OnyxValue>;

// Callback function for non-React subscribers
export type Callback<T = OnyxValue> = (value: T | null, key?: OnyxKey) => void;

// Selector function to extract data from state
export type Selector<T> = (state: OnyxState) => T;

// Subscription listener for the global store
export type Listener = () => void;

// Connection object returned by connect
export interface Connection {
    id: string;
}

// Init options
export interface InitOptions {
    keys?: Record<string, unknown>;
    maxCachedKeysCount?: number;
}

// Storage provider interface
export interface StorageProvider {
    getItem(key: OnyxKey): Promise<OnyxValue | null>;
    setItem(key: OnyxKey, value: OnyxValue): Promise<void>;
    removeItem(key: OnyxKey): Promise<void>;
    getAllKeys(): Promise<OnyxKey[]>;
    clear(): Promise<void>;
}

// Connect options for non-React usage
export interface ConnectOptions<T = OnyxValue> {
    key: OnyxKey;
    callback: Callback<T>;
    waitForCollectionCallback?: boolean;
}

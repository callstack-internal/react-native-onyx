/**
 * Store-Based Onyx Types
 * This is a prototype implementation focusing on global store pattern
 */

// Type for any Onyx key (string)
type OnyxKey = string;

// Type for any Onyx value
type OnyxValue = unknown;

// Type for collection keys (keys ending with '_')
type CollectionKey = string;

// The global store state structure
type StoreState = Record<OnyxKey, OnyxValue>;

// Listener function that gets called when store changes
type StoreListener = () => void;

// Selector function to extract data from store
type Selector<TValue = OnyxValue, TReturnValue = TValue> = (state: StoreState) => TReturnValue;

// Callback function types
type Callback<T = OnyxValue> = (value: T | null, key?: OnyxKey) => void;
type CollectionCallback<T = OnyxValue> = (collection: Record<OnyxKey, T>) => void;

// Connection options
interface ConnectOptions<T = OnyxValue> {
    key: OnyxKey;
    callback: Callback<T> | CollectionCallback<T>;
    waitForCollectionCallback?: boolean;
}

// Connection object returned by connect
interface Connection {
    id: string;
}

// Init options
interface InitOptions {
    keys?: Record<string, unknown>;
    maxCachedKeysCount?: number;
}

// Storage provider interface
interface StorageProvider {
    getItem(key: OnyxKey): Promise<OnyxValue | null>;
    setItem(key: OnyxKey, value: OnyxValue): Promise<void>;
    removeItem(key: OnyxKey): Promise<void>;
    getAllKeys(): Promise<OnyxKey[]>;
    clear(): Promise<void>;
    multiSet?(items: Array<[OnyxKey, OnyxValue]>): Promise<void>;
    multiGet?(keys: OnyxKey[]): Promise<Array<[OnyxKey, OnyxValue | null]>>;
}

export type {OnyxKey, OnyxValue, CollectionKey, StoreState, StoreListener, Selector, Callback, CollectionCallback, ConnectOptions, Connection, InitOptions, StorageProvider};

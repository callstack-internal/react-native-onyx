/**
 * Store-Based Onyx Types
 * This is a prototype implementation focusing on global store pattern
 */

// Type for any Onyx key (string)
export type OnyxKey = string;

// Type for any Onyx value
export type OnyxValue = unknown;

// Type for collection keys (keys ending with '_')
export type CollectionKey = string;

// The global store state structure
export type StoreState = Record<OnyxKey, OnyxValue>;

// Listener function that gets called when store changes
export type StoreListener = () => void;

// Selector function to extract data from store
export type Selector<TValue = OnyxValue, TReturnValue = TValue> = (state: StoreState) => TReturnValue;

// Callback function types
export type Callback<T = OnyxValue> = (value: T | null, key?: OnyxKey) => void;
export type CollectionCallback<T = OnyxValue> = (collection: Record<OnyxKey, T>) => void;

// Connection options
export interface ConnectOptions<T = OnyxValue> {
    key: OnyxKey;
    callback: Callback<T> | CollectionCallback<T>;
    waitForCollectionCallback?: boolean;
}

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
    multiSet?(items: Array<[OnyxKey, OnyxValue]>): Promise<void>;
    multiGet?(keys: OnyxKey[]): Promise<Array<[OnyxKey, OnyxValue | null]>>;
}

// Subscription callback type
export type SubscriptionCallback<T = OnyxValue> = (value: T | null, key: OnyxKey) => void;

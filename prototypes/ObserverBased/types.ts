/**
 * Observer-Based Onyx Types
 * Inspired by Legend-State's observable pattern
 */

// Type for any Onyx key
export type OnyxKey = string;

// Type for any Onyx value
export type OnyxValue = unknown;

// Observable node - tracks dependencies and notifies observers
export interface ObservableNode<T = OnyxValue> {
    value: T | null;
    observers: Set<Observer>;
    version: number;
}

// Observer - gets notified when observables change
export type Observer = () => void;

// Storage provider interface
export interface StorageProvider {
    getItem(key: OnyxKey): Promise<OnyxValue | null>;
    setItem(key: OnyxKey, value: OnyxValue): Promise<void>;
    removeItem(key: OnyxKey): Promise<void>;
    getAllKeys(): Promise<OnyxKey[]>;
    clear(): Promise<void>;
}

// Init options
export interface InitOptions {
    keys?: Record<string, unknown>;
    maxCachedKeysCount?: number;
}

// Connection object for non-React usage
export interface Connection {
    id: string;
}

// Callback for non-React subscriptions
export type Callback<T = OnyxValue> = (value: T | null, key?: OnyxKey) => void;

// Connect options
export interface ConnectOptions<T = OnyxValue> {
    key: OnyxKey;
    callback: Callback<T>;
}

// Observable wrapper type
export interface Observable<T = OnyxValue> {
    get(): T | null;
    set(value: T | null): void;
    observe(observer: Observer): () => void;
    peek(): T | null; // Get value without tracking
}

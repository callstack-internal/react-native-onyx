/**
 * Proxy-Based Onyx Types
 * Uses JavaScript Proxies for automatic reactivity
 */

// Type for any Onyx key
export type OnyxKey = string;

// Type for any Onyx value
export type OnyxValue = unknown;

// Reactive proxy wrapper
export type ReactiveProxy<T> = T;

// Dependency tracking
export type PropertyPath = string; // e.g., 'session.user.email'

// Effect callback - called when tracked properties change
export type EffectCallback = () => void;

// Subscriber callback
export type Callback<T = OnyxValue> = (value: T | null, key?: OnyxKey) => void;

// Connection object
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
}

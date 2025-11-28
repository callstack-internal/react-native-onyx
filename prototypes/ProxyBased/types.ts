/**
 * Proxy-Based Onyx Types
 * Uses JavaScript Proxies for automatic reactivity
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

export type {OnyxKey, OnyxValue, Callback, Connection, InitOptions, StorageProvider, ConnectOptions};

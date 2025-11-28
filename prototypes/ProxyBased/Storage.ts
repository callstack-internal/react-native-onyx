/**
 * Storage Layer for Proxy-Based Approach
 * Simple key-value storage (similar to KeyBased)
 */

import type {OnyxKey, OnyxValue, StorageProvider} from './types';

/**
 * In-memory storage provider
 */
class MemoryStorage implements StorageProvider {
    private storage: Map<OnyxKey, OnyxValue>;

    constructor() {
        this.storage = new Map();
    }

    async getItem(key: OnyxKey): Promise<OnyxValue | null> {
        const value = this.storage.get(key);
        return value !== undefined ? value : null;
    }

    async setItem(key: OnyxKey, value: OnyxValue): Promise<void> {
        this.storage.set(key, value);
    }

    async removeItem(key: OnyxKey): Promise<void> {
        this.storage.delete(key);
    }

    async getAllKeys(): Promise<OnyxKey[]> {
        return Array.from(this.storage.keys());
    }

    async clear(): Promise<void> {
        this.storage.clear();
    }
}

/**
 * Storage singleton
 */
class Storage {
    private provider: StorageProvider;

    constructor() {
        this.provider = new MemoryStorage();
    }

    async getItem(key: OnyxKey): Promise<OnyxValue | null> {
        return this.provider.getItem(key);
    }

    async setItem(key: OnyxKey, value: OnyxValue): Promise<void> {
        return this.provider.setItem(key, value);
    }

    async removeItem(key: OnyxKey): Promise<void> {
        return this.provider.removeItem(key);
    }

    async getAllKeys(): Promise<OnyxKey[]> {
        return this.provider.getAllKeys();
    }

    async clear(): Promise<void> {
        return this.provider.clear();
    }
}

const storage = new Storage();
export default storage;

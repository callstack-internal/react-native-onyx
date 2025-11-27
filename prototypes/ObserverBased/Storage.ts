/**
 * Simple in-memory storage provider
 * Can be swapped with IndexedDB, AsyncStorage, SQLite, etc.
 */

import type {OnyxKey, OnyxValue, StorageProvider} from './types';

/**
 * In-memory storage implementation
 */
class MemoryStorage implements StorageProvider {
    private storage = new Map<OnyxKey, OnyxValue>();

    async getItem(key: OnyxKey): Promise<OnyxValue | null> {
        return this.storage.get(key) ?? null;
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

// Singleton instance
const storage = new MemoryStorage();

export default storage;

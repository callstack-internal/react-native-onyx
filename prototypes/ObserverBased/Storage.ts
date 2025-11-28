/**
 * Storage Layer
 * Simple in-memory storage for the prototype
 * Can be replaced with IndexedDB, AsyncStorage, etc.
 */

import type {OnyxKey, OnyxValue, StorageProvider} from './types';

/**
 * In-memory storage implementation
 */
class MemoryStorage implements StorageProvider {
    private store: Map<OnyxKey, OnyxValue> = new Map();

    async getItem(key: OnyxKey): Promise<OnyxValue | null> {
        return this.store.get(key) ?? null;
    }

    async setItem(key: OnyxKey, value: OnyxValue): Promise<void> {
        this.store.set(key, value);
    }

    async removeItem(key: OnyxKey): Promise<void> {
        this.store.delete(key);
    }

    async getAllKeys(): Promise<OnyxKey[]> {
        return Array.from(this.store.keys());
    }

    async clear(): Promise<void> {
        this.store.clear();
    }
}

// Create a singleton instance
const storage = new MemoryStorage();

export default storage;
export {MemoryStorage};

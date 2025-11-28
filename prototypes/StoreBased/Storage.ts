/**
 * Storage Layer
 *
 * Provides persistent storage for Onyx data.
 * Uses in-memory storage by default (easily swappable with IndexedDB, AsyncStorage, etc.)
 *
 * Key difference from KeyBased:
 * - Supports collection-based storage (store entire collections together)
 * - Supports batch operations for efficiency
 */

import type {OnyxKey, OnyxValue, StorageProvider} from './types';

/**
 * In-memory storage implementation
 * Replace this with IndexedDB, AsyncStorage, or SQLite for real persistence
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

    async multiSet(items: Array<[OnyxKey, OnyxValue]>): Promise<void> {
        items.forEach(([key, value]) => {
            this.storage.set(key, value);
        });
    }

    async multiGet(keys: OnyxKey[]): Promise<Array<[OnyxKey, OnyxValue | null]>> {
        return keys.map((key) => [key, this.storage.get(key) ?? null]);
    }
}

/**
 * The active storage provider
 */
const provider: StorageProvider = new MemoryStorage();

/**
 * Get a value from storage
 */
async function getItem(key: OnyxKey): Promise<OnyxValue | null> {
    return provider.getItem(key);
}

/**
 * Set a value in storage
 */
async function setItem(key: OnyxKey, value: OnyxValue): Promise<void> {
    return provider.setItem(key, value);
}

/**
 * Remove a value from storage
 */
async function removeItem(key: OnyxKey): Promise<void> {
    return provider.removeItem(key);
}

/**
 * Get all keys from storage
 */
async function getAllKeys(): Promise<OnyxKey[]> {
    return provider.getAllKeys();
}

/**
 * Clear all data from storage
 */
async function clear(): Promise<void> {
    return provider.clear();
}

/**
 * Set multiple items at once (batch operation)
 */
async function multiSet(items: Array<[OnyxKey, OnyxValue]>): Promise<void> {
    if (provider.multiSet) {
        return provider.multiSet(items);
    }

    // Fallback to individual sets
    await Promise.all(items.map(([key, value]) => setItem(key, value)));
}

/**
 * Get multiple items at once (batch operation)
 */
async function multiGet(keys: OnyxKey[]): Promise<Array<[OnyxKey, OnyxValue | null]>> {
    if (provider.multiGet) {
        return provider.multiGet(keys);
    }

    // Fallback to individual gets
    const results = await Promise.all(keys.map((key) => getItem(key)));
    return keys.map((key, index) => [key, results[index]]);
}

/**
 * Set all items in a collection at once
 * More efficient than individual sets for collections
 */
async function setCollection(collection: Record<OnyxKey, OnyxValue>): Promise<void> {
    const items = Object.entries(collection);
    return multiSet(items);
}

// Export the Storage API
const Storage = {
    getItem,
    setItem,
    removeItem,
    getAllKeys,
    clear,
    multiSet,
    multiGet,
    setCollection,
};

export default Storage;

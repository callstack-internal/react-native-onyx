/**
 * Storage Layer for Store-Based Approach
 *
 * KEY DIFFERENCE: Collections are stored as single entries
 * - Regular key: 'session' → stored as 'session'
 * - Collection members: 'report_001', 'report_002' → stored together as 'report_' → { report_001: {...}, report_002: {...} }
 *
 * Benefits:
 * - Fewer storage operations (1 write for entire collection vs N writes)
 * - Atomic collection updates
 * - Faster initialization (load entire collection at once)
 */

import MemoryStorageProvider from './StorageProvider';
import type {OnyxKey, OnyxValue, StorageProvider} from './types';

/**
 * Check if a key is a collection key (ends with '_')
 */
function isCollectionKey(key: OnyxKey): boolean {
    return key.endsWith('_');
}

/**
 * Extract collection key from a member key
 * e.g., 'report_001' -> 'report_'
 */
function getCollectionKey(key: OnyxKey): OnyxKey | null {
    const match = key.match(/^(.+_)/);
    return match ? match[1] : null;
}

/**
 * Storage class with collection-based storage
 */
class Storage {
    private provider: StorageProvider;

    constructor() {
        this.provider = new MemoryStorageProvider();
    }

    /**
     * Set a custom storage provider (e.g., IndexedDB, AsyncStorage)
     */
    setProvider(provider: StorageProvider): void {
        this.provider = provider;
    }

    /**
     * Get a value from storage
     * If it's a collection member, extracts it from the collection
     */
    async getItem(key: OnyxKey): Promise<OnyxValue | null> {
        const collectionKey = getCollectionKey(key);

        if (collectionKey && !isCollectionKey(key)) {
            // This is a collection member (e.g., 'report_001')
            // Get the entire collection
            const collection = await this.provider.getItem(collectionKey);

            if (collection && typeof collection === 'object' && !Array.isArray(collection)) {
                return (collection as Record<string, OnyxValue>)[key] ?? null;
            }

            return null;
        }

        // Regular key or collection key itself - get directly
        return this.provider.getItem(key);
    }

    /**
     * Set a value in storage
     * If it's a collection member, updates the entire collection
     */
    async setItem(key: OnyxKey, value: OnyxValue): Promise<void> {
        const collectionKey = getCollectionKey(key);

        if (collectionKey && !isCollectionKey(key)) {
            // This is a collection member (e.g., 'report_001')
            // Get the current collection
            const collection = ((await this.provider.getItem(collectionKey)) as Record<string, OnyxValue>) || {};

            // Update the member
            if (value === null) {
                delete collection[key];
            } else {
                collection[key] = value;
            }

            // Save the entire collection
            await this.provider.setItem(collectionKey, collection);
        } else {
            // Regular key - set directly
            await this.provider.setItem(key, value);
        }
    }

    /**
     * Set multiple collection members at once
     * Much more efficient than individual setItem calls
     */
    async setCollectionMembers(collectionKey: OnyxKey, members: Record<OnyxKey, OnyxValue>): Promise<void> {
        // Get current collection
        const collection = ((await this.provider.getItem(collectionKey)) as Record<string, OnyxValue>) || {};

        // Update all members
        Object.entries(members).forEach(([key, value]) => {
            if (value === null) {
                delete collection[key];
            } else {
                collection[key] = value;
            }
        });

        // Save the entire collection once
        await this.provider.setItem(collectionKey, collection);
    }

    /**
     * Get entire collection
     */
    async getCollection(collectionKey: OnyxKey): Promise<Record<OnyxKey, OnyxValue>> {
        const collection = await this.provider.getItem(collectionKey);

        if (collection && typeof collection === 'object' && !Array.isArray(collection)) {
            return collection as Record<OnyxKey, OnyxValue>;
        }

        return {};
    }

    /**
     * Remove a value from storage
     */
    async removeItem(key: OnyxKey): Promise<void> {
        const collectionKey = getCollectionKey(key);

        if (collectionKey && !isCollectionKey(key)) {
            // This is a collection member - remove from collection
            const collection = ((await this.provider.getItem(collectionKey)) as Record<string, OnyxValue>) || {};
            delete collection[key];
            await this.provider.setItem(collectionKey, collection);
        } else {
            // Regular key - remove directly
            await this.provider.removeItem(key);
        }
    }

    /**
     * Get all keys from storage
     * Expands collections to include all member keys
     */
    async getAllKeys(): Promise<OnyxKey[]> {
        const storageKeys = await this.provider.getAllKeys();
        const allKeys: OnyxKey[] = [];

        for (const key of storageKeys) {
            if (isCollectionKey(key)) {
                // This is a collection - get all member keys
                const collection = await this.getCollection(key);
                allKeys.push(...Object.keys(collection));
            } else {
                allKeys.push(key);
            }
        }

        return allKeys;
    }

    /**
     * Clear all storage
     */
    async clear(): Promise<void> {
        await this.provider.clear();
    }
}

const storage = new Storage();
export default storage;
export {isCollectionKey, getCollectionKey};

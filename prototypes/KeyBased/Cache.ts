/**
 * Simplified Cache Layer
 * Provides in-memory caching with LRU (Least Recently Used) eviction
 */

import type {OnyxKey, OnyxValue} from './types';

/**
 * Cache class with LRU eviction support
 */
class Cache {
    private cache: Map<OnyxKey, OnyxValue>;

    private maxSize: number;

    private accessOrder: Set<OnyxKey>;

    // Cache for aggregated collections to maintain referential equality
    private collectionCache: Map<OnyxKey, {keys: Set<OnyxKey>; value: Record<OnyxKey, OnyxValue>}>;

    constructor() {
        this.cache = new Map();
        this.maxSize = 1000;
        this.accessOrder = new Set();
        this.collectionCache = new Map();
    }

    /**
     * Set the maximum number of keys to cache
     */
    setMaxSize(size: number): void {
        this.maxSize = size;
        this.evictIfNeeded();
    }

    /**
     * Get a value from cache
     */
    get(key: OnyxKey): OnyxValue | undefined {
        if (!this.cache.has(key)) {
            return undefined;
        }

        // Update access order (move to end = most recently used)
        this.accessOrder.delete(key);
        this.accessOrder.add(key);

        return this.cache.get(key);
    }

    /**
     * Set a value in cache
     */
    set(key: OnyxKey, value: OnyxValue): void {
        // Update access order
        this.accessOrder.delete(key);
        this.accessOrder.add(key);

        this.cache.set(key, value);

        // Invalidate collection cache for this key's collection
        this.invalidateCollectionCache(key);

        // Evict if cache is too large
        this.evictIfNeeded();
    }

    /**
     * Check if a key exists in cache
     */
    has(key: OnyxKey): boolean {
        return this.cache.has(key);
    }

    /**
     * Remove a key from cache
     */
    delete(key: OnyxKey): void {
        this.cache.delete(key);
        this.accessOrder.delete(key);

        // Invalidate collection cache for this key's collection
        this.invalidateCollectionCache(key);
    }

    /**
     * Clear the entire cache
     */
    clear(): void {
        this.cache.clear();
        this.accessOrder.clear();
        this.collectionCache.clear();
    }

    /**
     * Invalidate collection cache when a member key changes
     */
    private invalidateCollectionCache(memberKey: OnyxKey): void {
        // Find which collection this key belongs to
        const match = memberKey.match(/^(.+_)/);
        if (match) {
            const collectionKey = match[1];
            this.collectionCache.delete(collectionKey);
        }
    }

    /**
     * Get all cached keys
     */
    getAllKeys(): OnyxKey[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Get cache size
     */
    getSize(): number {
        return this.cache.size;
    }

    /**
     * Get all values for a collection key by aggregating matching members
     * Similar to OnyxUtils.getCachedCollection() in actual Onyx
     * This method caches the aggregated result to maintain referential equality
     */
    getCollection(collectionKey: OnyxKey): Record<OnyxKey, OnyxValue> | undefined {
        if (!collectionKey.endsWith('_')) {
            return undefined;
        }

        // Build current set of collection member keys
        const currentKeys = new Set<OnyxKey>();
        this.cache.forEach((value, key) => {
            if (key.startsWith(collectionKey) && key !== collectionKey && value !== null && value !== undefined) {
                currentKeys.add(key);
            }
        });

        // Check if we have a cached version
        const cached = this.collectionCache.get(collectionKey);
        if (cached) {
            // Check if the keys are the same
            const keysChanged = currentKeys.size !== cached.keys.size || Array.from(currentKeys).some((k) => !cached.keys.has(k));

            if (!keysChanged) {
                // Keys haven't changed, check if values changed
                const valuesChanged = Array.from(currentKeys).some((k) => {
                    return this.cache.get(k) !== cached.value[k];
                });

                if (!valuesChanged) {
                    // Nothing changed, return cached value
                    return cached.value;
                }
            }
        }

        // Build new collection object
        const collection: Record<OnyxKey, OnyxValue> = {};
        let hasMembers = false;

        currentKeys.forEach((key) => {
            const value = this.cache.get(key);
            if (value !== null && value !== undefined) {
                collection[key] = value;
                hasMembers = true;
            }
        });

        // Cache the result
        if (hasMembers) {
            this.collectionCache.set(collectionKey, {keys: currentKeys, value: collection});
            return collection;
        }

        return undefined;
    }

    /**
     * Evict least recently used keys if cache exceeds max size
     */
    private evictIfNeeded(): void {
        if (this.maxSize <= 0 || this.cache.size <= this.maxSize) {
            return;
        }

        // Evict keys until we're under the max size
        const keysToEvict = this.cache.size - this.maxSize;
        const accessOrderArray = Array.from(this.accessOrder);

        for (let i = 0; i < keysToEvict; i++) {
            const keyToEvict = accessOrderArray[i];
            if (keyToEvict) {
                this.cache.delete(keyToEvict);
                this.accessOrder.delete(keyToEvict);
            }
        }
    }
}

const cache = new Cache();
export default cache;

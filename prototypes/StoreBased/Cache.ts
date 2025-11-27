/**
 * Cache Layer with LRU Eviction
 * Provides in-memory caching for StoreBased approach
 */

import type {OnyxKey, OnyxValue} from './types';

/**
 * Cache class with LRU (Least Recently Used) eviction support
 */
class Cache {
    /** Map storing the cached data */
    private cache: Map<OnyxKey, OnyxValue>;

    /** Maximum number of keys to cache (0 = unlimited) */
    private maxSize: number;

    /** Set tracking access order (most recent at the end) */
    private accessOrder: Set<OnyxKey>;

    constructor() {
        this.cache = new Map();
        this.maxSize = 1000;
        this.accessOrder = new Set();
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

        // Evict if cache is too large
        this.evictIfNeeded();
    }

    /**
     * Set multiple values at once
     */
    setMany(entries: Record<OnyxKey, OnyxValue>): void {
        Object.entries(entries).forEach(([key, value]) => {
            // Update access order
            this.accessOrder.delete(key);
            this.accessOrder.add(key);

            this.cache.set(key, value);
        });

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
    }

    /**
     * Clear the entire cache
     */
    clear(): void {
        this.cache.clear();
        this.accessOrder.clear();
    }

    /**
     * Get all cached keys
     */
    getAllKeys(): OnyxKey[] {
        return Array.from(this.cache.keys());
    }

    /**
     * Get all cached data as an object
     * This is what OnyxStore.getState() will return
     */
    getAllData(): Record<OnyxKey, OnyxValue> {
        const data: Record<OnyxKey, OnyxValue> = {};
        this.cache.forEach((value, key) => {
            data[key] = value;
        });
        return data;
    }

    /**
     * Get cache size
     */
    getSize(): number {
        return this.cache.size;
    }

    /**
     * Get collection members from cache
     * Returns all keys that start with the collection key prefix
     */
    getCollectionMembers(collectionKey: OnyxKey): Record<OnyxKey, OnyxValue> {
        const collection: Record<OnyxKey, OnyxValue> = {};

        for (const [key, value] of this.cache.entries()) {
            if (key.startsWith(collectionKey)) {
                collection[key] = value;
            }
        }

        return collection;
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

        console.log(`[Cache] Evicted ${keysToEvict} keys (LRU)`);
    }
}

const cache = new Cache();
export default cache;

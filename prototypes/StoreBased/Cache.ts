/**
 * Cache - In-Memory LRU Cache
 *
 * Provides fast synchronous access to frequently used data.
 * Uses Least Recently Used (LRU) eviction policy.
 */

import type {OnyxKey, OnyxValue} from './types';

/**
 * Cache entry with access tracking
 */
interface CacheEntry {
    value: OnyxValue;
    lastAccessed: number;
}

/**
 * The cache storage
 */
const cache = new Map<OnyxKey, CacheEntry>();

/**
 * Maximum number of keys to cache
 */
let maxSize = 1000;

/**
 * Set the maximum cache size
 */
function setMaxSize(size: number): void {
    maxSize = size;
    evictIfNeeded();
}

/**
 * Get a value from cache
 */
function get(key: OnyxKey): OnyxValue | undefined {
    const entry = cache.get(key);

    if (entry) {
        // Update last accessed time
        entry.lastAccessed = Date.now();
        return entry.value;
    }

    return undefined;
}

/**
 * Set a value in cache
 */
function set(key: OnyxKey, value: OnyxValue): void {
    cache.set(key, {
        value,
        lastAccessed: Date.now(),
    });

    evictIfNeeded();
}

/**
 * Delete a key from cache
 */
function deleteKey(key: OnyxKey): void {
    cache.delete(key);
}

/**
 * Check if a key exists in cache
 */
function has(key: OnyxKey): boolean {
    return cache.has(key);
}

/**
 * Clear the entire cache
 */
function clear(): void {
    cache.clear();
}

/**
 * Evict least recently used items if cache is over max size
 */
function evictIfNeeded(): void {
    if (cache.size <= maxSize) {
        return;
    }

    // Find the least recently used key
    let oldestKey: OnyxKey | null = null;
    let oldestTime = Infinity;

    cache.forEach((entry, key) => {
        if (entry.lastAccessed < oldestTime) {
            oldestTime = entry.lastAccessed;
            oldestKey = key;
        }
    });

    // Remove the oldest entry
    if (oldestKey) {
        cache.delete(oldestKey);
    }
}

/**
 * Get all keys in cache
 */
function getAllKeys(): OnyxKey[] {
    return Array.from(cache.keys());
}

/**
 * Get cache statistics
 */
function getStats() {
    return {
        size: cache.size,
        maxSize,
        utilizationPercent: Math.round((cache.size / maxSize) * 100),
    };
}

// Export the Cache API
const Cache = {
    setMaxSize,
    get,
    set,
    delete: deleteKey,
    has,
    clear,
    getAllKeys,
    getStats,
};

export default Cache;

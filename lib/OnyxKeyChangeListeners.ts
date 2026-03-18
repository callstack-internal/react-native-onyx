import cache from './OnyxCache';
import type {OnyxKey, OnyxValue} from './types';

type KeyChangeListener = (sourceValue?: OnyxValue<OnyxKey>) => void;

// Lightweight key-change listeners for useOnyx. Maps an Onyx key (or collection base key)
// to a Set of notification callbacks. Bypasses the connection manager entirely.
// The optional sourceValue param carries the partial change data for collection updates.
let keyChangeListeners = new Map<OnyxKey, Set<KeyChangeListener>>();

/**
 * Subscribe to key-change notifications. The listener is called whenever the key's value
 * changes in cache (via keyChanged / keysChanged). For collection member keys, listeners
 * registered on the collection base key are also notified.
 *
 * The listener receives an optional `sourceValue` — the partial data that changed.
 * Only meaningful for collection keys.
 *
 * @returns An unsubscribe function.
 */
function subscribeToKeyChanges(key: OnyxKey, listener: KeyChangeListener): () => void {
    if (!keyChangeListeners.has(key)) {
        keyChangeListeners.set(key, new Set());
    }
    keyChangeListeners.get(key)!.add(listener);

    return () => {
        const listeners = keyChangeListeners.get(key);
        if (listeners) {
            listeners.delete(listener);
            if (listeners.size === 0) {
                keyChangeListeners.delete(key);
            }
        }
    };
}

/**
 * Notify all lightweight key-change listeners for a given key.
 * Also notifies listeners on the parent collection key unless `skipCollectionListeners` is true
 * (used during batch collection updates where keysChanged handles collection-level notification).
 */
function notifyKeyChangeListeners(key: OnyxKey, skipCollectionListeners = false, sourceValue?: OnyxValue<OnyxKey>): void {
    // Direct key listeners (e.g. useOnyx('report_123')) — no sourceValue, matching old behavior.
    const listeners = keyChangeListeners.get(key);
    if (listeners) {
        for (const listener of listeners) {
            listener();
        }
    }

    // Collection-level listeners (e.g. useOnyx('report_')) — receive sourceValue (partial change data).
    // Guard: skip if the key IS the collection key (avoid double-notifying the same listeners).
    if (!skipCollectionListeners) {
        const collectionKey = cache.getCollectionKey(key);
        if (collectionKey && collectionKey !== key) {
            const collectionListeners = keyChangeListeners.get(collectionKey);
            if (collectionListeners) {
                for (const listener of collectionListeners) {
                    listener(sourceValue);
                }
            }
        }
    }
}

/**
 * Notify listeners for a collection update (called from keysChanged).
 * Notifies the collection base key once with partialCollection as sourceValue,
 * and each individual member key once without sourceValue.
 */
function notifyCollectionKeyChangeListeners(collectionKey: OnyxKey, partialCollection: Record<string, unknown> | undefined): void {
    const collectionListeners = keyChangeListeners.get(collectionKey);
    if (collectionListeners) {
        for (const listener of collectionListeners) {
            listener(partialCollection);
        }
    }
    if (partialCollection) {
        for (const key of Object.keys(partialCollection)) {
            const memberListeners = keyChangeListeners.get(key);
            if (memberListeners) {
                for (const listener of memberListeners) {
                    listener();
                }
            }
        }
    }
}

/**
 * Clear all key-change listeners. Used in test environments.
 */
function clearKeyChangeListeners(): void {
    keyChangeListeners = new Map();
}

export {subscribeToKeyChanges, notifyKeyChangeListeners, notifyCollectionKeyChangeListeners, clearKeyChangeListeners};
export type {KeyChangeListener};

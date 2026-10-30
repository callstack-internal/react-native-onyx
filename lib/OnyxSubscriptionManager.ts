import type {CollectionKeyBase, KeyValueMapping, OnyxCollection, OnyxKey, OnyxValue} from './types';

import * as Logger from './Logger';
import cache from './OnyxCache';
import OnyxKeys from './OnyxKeys';
import Storage from './storage';

/**
 * Listener fired when an exact key's value changes.
 */
type Listener<TKey extends OnyxKey = OnyxKey> = (value: OnyxValue<TKey>, key: TKey) => void;

/**
 * Generic listener, without specific types for the keys or values.
 * This way a single Map can hold listeners for every key type.
 */
type GenericListener = (value: unknown, key: OnyxKey) => void;

const reportedCacheMisses = new Set<OnyxKey>();

// QA: last time the cross-tab sync erased a cached value for a key, recorded by the sync handler in Onyx.ts.
// Lets a confirmed miss say what emptied the cache and whether a local write was in flight at that moment.
type QaErasure = {at: number; pendingLocalWrites: number; erasedValue: unknown};
const qaErasures = new Map<OnyxKey, QaErasure>();
function qaRecordErasure(key: OnyxKey, pendingLocalWrites: number, erasedValue: unknown): void {
    qaErasures.set(key, {at: Date.now(), pendingLocalWrites, erasedValue});
    // A new episode for this key: let the next miss report again instead of hiding behind the per-key dedupe.
    reportedCacheMisses.delete(key);
}

function reportCacheMissIfStorageHasValue(key: OnyxKey): void {
    if (!cache.getAllKeys().has(key) || OnyxKeys.isRamOnlyKey(key) || cache.hasNullishStorageKey(key)) {
        return;
    }

    // QA: mark per key instead of per collection so every real miss is visible, not only the first per collection.
    if (reportedCacheMisses.has(key)) {
        return;
    }
    reportedCacheMisses.add(key);
    const missedAt = Date.now();

    Storage.getItem(key)
        .then((value) => {
            if (value === undefined || value === null) {
                // Storage is empty too: a removal, not a loss. Silent in QA.
                return;
            }

            const erasure = qaErasures.get(key);
            const cacheValueNow = cache.get(key);
            const msSinceErasure = erasure ? missedAt - erasure.at : undefined;
            let verdict: string;
            if (cacheValueNow === undefined) {
                verdict = erasure ? 'BUG: value still missing from cache after a sync erasure, storage has it' : 'BUG: value missing from cache, no sync erasure recorded, unknown cause';
            } else if (erasure && erasure.pendingLocalWrites > 0) {
                verdict = 'RACE HEALED: sync erased a value this tab was writing, a later write refilled the cache';
            } else if (erasure) {
                verdict = 'TRANSIENT: sync erased the value, this tab rewrote it within the gap, subscribers saw undefined briefly';
            } else {
                verdict = 'ODD: cache has a value again with no erasure recorded';
            }
            console.log(`🚨 [OnyxQA] ${verdict}`, {
                key,
                storageValue: value,
                cacheValueNow,
                msSinceErasure,
                erasedValue: erasure?.erasedValue,
                pendingLocalWritesAtErasure: erasure?.pendingLocalWrites,
            });
            // QA: settle the verdict. A value in transit through the next sync batch or a rewrite lands within a few
            // hundred ms. What is left after that is the real state.
            setTimeout(() => {
                Storage.getItem(key).then((storageLater) => {
                    const cacheLater = cache.get(key);
                    let finalVerdict: string;
                    if (cacheLater !== undefined) {
                        finalVerdict = 'HEALED: cache has a value again, this was propagation lag, not a loss';
                    } else if (storageLater === undefined || storageLater === null) {
                        finalVerdict = 'CONVERGED EMPTY: storage is empty too now, another tab removed it again';
                    } else {
                        finalVerdict = 'PERSISTENT LOSS: cache still empty, storage still has a value';
                    }
                    console.log(`🏁 [OnyxQA] ${finalVerdict}`, {key, cacheLater, storageLater});
                });
            }, 500);
            Logger.logHmmm(`Cache held no value for a key storage still has: ${OnyxKeys.getCollectionKey(key) ?? key}`);
        })
        .catch((error: unknown) => {
            Logger.logInfo(`Could not check storage for a suspected cache miss on ${key}. Error: ${String(error)}`);
        });
}

/**
 * OnyxSubscriptionManager is a registry for Onyx subscriptions.
 * Subscriptions are stored in `keyListeners`, a flat map keyed by OnyxKey.
 * Subscribers are notified on a per-key basis:
 *    - `notifyKey` for individual keys or collection members
 *    - `notifyCollection` for batch updates to collections
 */
class OnyxSubscriptionManager {
    private keyListeners: Map<OnyxKey, Set<GenericListener>>;

    constructor() {
        this.keyListeners = new Map();
    }

    /**
     * Returns the frozen collection object for collection
     * keys, the cached value for single keys, or `undefined` if not in cache.
     */
    getState<TKey extends OnyxKey>(key: TKey): OnyxValue<TKey> {
        if (OnyxKeys.isCollectionKey(key)) {
            return cache.getCollectionData(key) as OnyxValue<TKey>;
        }

        const value = cache.get(key) as OnyxValue<TKey>;
        if (value === undefined) {
            reportCacheMissIfStorageHasValue(key);
        }

        return value;
    }

    /**
     * Subscribe to an exact key. For a collection root key this is "collection mode": the
     * listener fires with the frozen collection object whenever any member changes. For a
     * collection member key or a regular key, the listener fires when that key's value changes.
     *
     * Returns an unsubscribe function.
     */
    subscribe<TKey extends OnyxKey>(key: TKey, listener: Listener<TKey>): () => void {
        let listeners = this.keyListeners.get(key);
        if (!listeners) {
            listeners = new Set();
            this.keyListeners.set(key, listeners);
        }

        listeners.add(listener as GenericListener);

        return () => {
            const set = this.keyListeners.get(key);
            if (!set) {
                return;
            }

            set.delete(listener as GenericListener);

            if (set.size === 0) {
                this.keyListeners.delete(key);
            }
        };
    }

    /**
     * Notify of a single-key write.
     *
     * Dispatch:
     *   1. keyListeners.get(key): exact-key subscribers (always fires).
     *   2. If key is a collection member, keyListeners.get(collectionKey): collection
     *      listeners for the parent collection.
     */
    notifyKey<TKey extends OnyxKey>(key: TKey, value: OnyxValue<TKey>): void {
        // 1. Exact-key listeners
        const exact = this.keyListeners.get(key);
        if (exact && exact.size > 0) {
            for (const listener of [...exact]) {
                this.safeInvoke(() => listener(value, key), key);
            }
        }

        // 2. Collection-level routing. Only fires when the write is to a member key.
        // Direct writes to a collection root (e.g. `Onyx.merge(COLLECTION_KEY, ...)`) are an
        // unsupported anti-pattern; treat them as opaque single-key writes.
        const collectionKey = OnyxKeys.getCollectionKey(key);
        const isCollectionMemberWrite = collectionKey !== undefined && collectionKey !== key;
        if (isCollectionMemberWrite) {
            const collectionListeners = this.keyListeners.get(collectionKey);
            if (collectionListeners && collectionListeners.size > 0) {
                const collectionData = cache.getCollectionData(collectionKey);
                for (const listener of [...collectionListeners]) {
                    this.safeInvoke(() => listener(collectionData, collectionKey), collectionKey);
                }
            }
        }
    }

    /**
     * Notify of a collection-level batch update.
     *
     * Dispatch:
     *   1. keyListeners.get(collectionKey): fires once with the new collection object.
     *   2. keyListeners.get(memberKey): fires per changed member whose value differs from
     *      the previous, preserving ref-equality on unchanged members.
     */
    notifyCollection<TKey extends CollectionKeyBase>(
        collectionKey: TKey,
        partialCollection: OnyxCollection<KeyValueMapping[TKey]>,
        partialPreviousCollection?: OnyxCollection<KeyValueMapping[TKey]>,
    ): void {
        const changedKeys = Object.keys(partialCollection ?? {});
        if (changedKeys.length === 0) {
            return;
        }
        // Read the merged collection once. `cache.getCollectionData()` returns the post-merge
        // frozen object, which is what listeners should see (not the raw `partialCollection`
        // input, which is just the delta and lacks fields preserved during merge).
        const collectionData = cache.getCollectionData(collectionKey);

        // 1. Collection listeners fire once with the new collection object.
        const collectionListeners = this.keyListeners.get(collectionKey);
        if (collectionListeners && collectionListeners.size > 0) {
            for (const listener of [...collectionListeners]) {
                this.safeInvoke(() => listener(collectionData, collectionKey), collectionKey);
            }
        }

        // 2. Exact-member subscribers fire per changed key (skip if ref unchanged vs previous).
        // Only treat a member as unchanged when `previous` actually carries it: when the
        // previous collection is omitted, a removed member reads `undefined` on both sides
        // and would otherwise be skipped even though it changed.
        for (const memberKey of changedKeys) {
            const value = collectionData?.[memberKey];
            const prev = partialPreviousCollection?.[memberKey];
            if (partialPreviousCollection && Object.prototype.hasOwnProperty.call(partialPreviousCollection, memberKey) && value === prev) {
                continue;
            }

            const exact = this.keyListeners.get(memberKey);
            if (!exact || exact.size === 0) {
                continue;
            }

            for (const listener of [...exact]) {
                this.safeInvoke(() => listener(value, memberKey), memberKey);
            }
        }
    }

    /**
     * Wipe all subscriptions. Used by tests and `Onyx.clear()` follow-on.
     */
    clearAll(): void {
        this.keyListeners.clear();
        this.resetCacheMissReports();
    }

    resetCacheMissReports(): void {
        reportedCacheMisses.clear();
        qaErasures.clear();
    }

    qaRecordErasure(key: OnyxKey, pendingLocalWrites: number, erasedValue: unknown): void {
        qaRecordErasure(key, pendingLocalWrites, erasedValue);
    }

    /**
     * True if there are any subscribers for the given key (exact or parent collection).
     */
    hasListenersForKey(key: OnyxKey): boolean {
        if ((this.keyListeners.get(key)?.size ?? 0) > 0) {
            return true;
        }

        const collectionKey = OnyxKeys.getCollectionKey(key);
        if (collectionKey && collectionKey !== key && (this.keyListeners.get(collectionKey)?.size ?? 0) > 0) {
            return true;
        }

        return false;
    }

    /**
     * Runs a listener, catching and logging any throw so one failing listener can't stop the rest.
     */
    private safeInvoke(fn: () => void, contextKey: OnyxKey): void {
        try {
            fn();
        } catch (error) {
            Logger.logAlert(`[OnyxSubscriptionManager] Listener threw an error for key '${contextKey}': ${error}`);
        }
    }
}

const onyxSubscriptionManager = new OnyxSubscriptionManager();

export default onyxSubscriptionManager;
export type {Listener};

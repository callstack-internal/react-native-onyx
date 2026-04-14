import OnyxKeys from './OnyxKeys';
import type {CollectionKeyBase, OnyxKey} from './types';

type Listener = () => void;

const keyListeners = new Map<OnyxKey, Set<Listener>>();
const collectionListeners = new Map<CollectionKeyBase, Set<Listener>>();

function subscribeToKey(key: OnyxKey, listener: Listener): () => void {
    let listeners = keyListeners.get(key);
    if (!listeners) {
        listeners = new Set();
        keyListeners.set(key, listeners);
    }
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            keyListeners.delete(key);
        }
    };
}

function subscribeToCollection(collectionKey: CollectionKeyBase, listener: Listener): () => void {
    let listeners = collectionListeners.get(collectionKey);
    if (!listeners) {
        listeners = new Set();
        collectionListeners.set(collectionKey, listeners);
    }
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            collectionListeners.delete(collectionKey);
        }
    };
}

/**
 * Notify only direct key listeners, no collection fan-out.
 * Used during collection updates where keysChanged handles collection notification separately.
 */
function notifyKey(key: OnyxKey): void {
    const listeners = keyListeners.get(key);
    if (listeners) {
        listeners.forEach((listener) => listener());
    }
}

/**
 * Notify only collection listeners for a given collection key.
 * Used by keysChanged to notify collection subscribers once per batch.
 */
function notifyCollection(collectionKey: CollectionKeyBase): void {
    const listeners = collectionListeners.get(collectionKey);
    if (listeners) {
        listeners.forEach((listener) => listener());
    }
}

/**
 * Notify direct key listeners AND matching collection listeners.
 * Used by keyChanged for non-collection-update mutations.
 */
function notify(key: OnyxKey): void {
    notifyKey(key);

    const collectionKey = OnyxKeys.getCollectionKey(key);
    if (collectionKey && collectionKey !== key) {
        notifyCollection(collectionKey as CollectionKeyBase);
    }
}

export default {subscribeToKey, subscribeToCollection, notify, notifyKey, notifyCollection};
export type {Listener};

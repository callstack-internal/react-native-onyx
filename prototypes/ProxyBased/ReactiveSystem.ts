/**
 * Valtio-inspired Reactive System
 *
 * KEY CONCEPTS:
 * 1. Create mutable proxy state with proxy()
 * 2. Mutate directly - no set() or merge() needed
 * 3. Subscribe with snapshot() to get immutable snapshots
 * 4. Automatic change detection via Proxy traps
 */

// Global listeners that get notified on any change
type Listener = () => void;
const listeners = new Set<Listener>();

// WeakMaps to track proxies
const proxyCache = new WeakMap<object, any>();
const snapshotCache = new WeakMap<object, any>();
const versionCache = new WeakMap<object, number>();

/**
 * Create a proxy that tracks all mutations
 */
function createProxy<T extends object>(initialState: T): T {
    // Return existing proxy if available
    if (proxyCache.has(initialState)) {
        return proxyCache.get(initialState);
    }

    // Initialize version
    versionCache.set(initialState, 0);

    const proxy = new Proxy(initialState, {
        get(target: any, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);

            // If it's an object, make it reactive too (deep reactivity)
            if (value !== null && typeof value === 'object') {
                return createProxy(value);
            }

            return value;
        },

        set(target: any, prop, value, receiver) {
            const prevValue = Reflect.get(target, prop, receiver);

            // Set the new value
            const result = Reflect.set(target, prop, value, receiver);

            // Notify if value changed
            if (prevValue !== value) {
                // Increment version
                const version = versionCache.get(target) || 0;
                versionCache.set(target, version + 1);

                // Clear snapshot cache
                snapshotCache.delete(target);

                // Notify listeners
                notifyListeners();
            }

            return result;
        },

        deleteProperty(target: any, prop) {
            const result = Reflect.deleteProperty(target, prop);

            if (result) {
                // Increment version
                const version = versionCache.get(target) || 0;
                versionCache.set(target, version + 1);

                // Clear snapshot cache
                snapshotCache.delete(target);

                // Notify listeners
                notifyListeners();
            }

            return result;
        },
    });

    proxyCache.set(initialState, proxy);
    return proxy;
}

/**
 * Create an immutable snapshot of the proxy state
 * Used by React hooks to prevent accidental mutations
 */
function snapshot<T extends object>(proxyObject: T): T {
    // Check cache first
    if (snapshotCache.has(proxyObject)) {
        return snapshotCache.get(proxyObject);
    }

    // Create immutable snapshot
    const snap: any = Array.isArray(proxyObject) ? [] : {};

    for (const key in proxyObject) {
        const value = (proxyObject as any)[key];

        if (value !== null && typeof value === 'object') {
            // Recursively snapshot nested objects
            snap[key] = snapshot(value);
        } else {
            snap[key] = value;
        }
    }

    // Freeze to make immutable
    Object.freeze(snap);

    // Cache the snapshot
    snapshotCache.set(proxyObject, snap);

    return snap;
}

/**
 * Subscribe to changes
 * Returns unsubscribe function
 */
function subscribe(listener: Listener): () => void {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

/**
 * Notify all listeners
 */
function notifyListeners(): void {
    listeners.forEach((listener) => listener());
}

export {createProxy as proxy, snapshot, subscribe};

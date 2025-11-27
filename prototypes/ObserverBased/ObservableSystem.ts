/**
 * Legend-State inspired Observable System
 *
 * KEY CONCEPTS:
 * 1. Observables track their observers (who's watching)
 * 2. When observable value changes, notify all observers
 * 3. Fine-grained reactivity - only re-render what changed
 * 4. Automatic dependency tracking during component render
 *
 * Similar to: Legend-State, Solid.js signals, MobX observables
 */

import type {OnyxKey, OnyxValue, Observer, ObservableNode, Observable} from './types';

// Global tracking context - which observer is currently running
let currentObserver: Observer | null = null;

// Store all observable nodes by key
const observableNodes = new Map<OnyxKey, ObservableNode>();

/**
 * Get or create an observable node for a key
 */
function getOrCreateNode<T = OnyxValue>(key: OnyxKey): ObservableNode<T> {
    if (!observableNodes.has(key)) {
        observableNodes.set(key, {
            value: null,
            observers: new Set<Observer>(),
            version: 0,
        });
    }
    return observableNodes.get(key) as ObservableNode<T>;
}

/**
 * Create an observable for a specific key
 * This is the core primitive that everything else builds on
 */
export function observable<T = OnyxValue>(key: OnyxKey): Observable<T> {
    const node = getOrCreateNode<T>(key);

    return {
        /**
         * Get the current value and track this access
         * If called during an observer execution, adds observer to dependencies
         */
        get(): T | null {
            // Track this access if we're inside an observer
            if (currentObserver) {
                node.observers.add(currentObserver);
            }
            return node.value;
        },

        /**
         * Set a new value and notify all observers
         */
        set(newValue: T | null): void {
            if (node.value !== newValue) {
                node.value = newValue;
                node.version++;

                // Notify all observers that depend on this observable
                notifyObservers(node);
            }
        },

        /**
         * Observe changes to this observable
         * Returns an unsubscribe function
         */
        observe(observer: Observer): () => void {
            node.observers.add(observer);

            // Return unsubscribe function
            return () => {
                node.observers.delete(observer);
            };
        },

        /**
         * Peek at the value without tracking the access
         * Useful when you want to read but not create a dependency
         */
        peek(): T | null {
            return node.value;
        },
    };
}

/**
 * Notify all observers of a node that the value changed
 */
function notifyObservers(node: ObservableNode): void {
    // Create a copy of observers to avoid issues if observers modify the set during iteration
    const observersToNotify = Array.from(node.observers);

    observersToNotify.forEach((observer) => {
        try {
            observer();
        } catch (error) {
            console.error('[ObservableSystem] Error in observer:', error);
        }
    });
}

/**
 * Run a function and track which observables it accesses
 * Returns cleanup function to stop tracking
 */
export function track(fn: () => void): () => void {
    const observer: Observer = () => {
        // When observable changes, re-run the function
        const prevObserver = currentObserver;
        currentObserver = observer;
        try {
            fn();
        } finally {
            currentObserver = prevObserver;
        }
    };

    // Run once initially to establish dependencies
    observer();

    // Return cleanup function
    return () => {
        // Remove this observer from all nodes
        observableNodes.forEach((node) => {
            node.observers.delete(observer);
        });
    };
}

/**
 * Batch multiple updates together to avoid excessive notifications
 * Similar to React's batch updates
 */
export function batch(fn: () => void): void {
    // Simple implementation: collect all changed nodes, then notify once
    const changedNodes = new Set<ObservableNode>();
    const originalNotify = notifyObservers;

    // Temporarily replace notify to collect changes
    const batchNotify = (node: ObservableNode) => {
        changedNodes.add(node);
    };

    try {
        // Run the function with batched notifications
        Object.defineProperty(globalThis, 'notifyObservers', {
            value: batchNotify,
            writable: true,
        });
        fn();
    } finally {
        // Restore original notify
        Object.defineProperty(globalThis, 'notifyObservers', {
            value: originalNotify,
            writable: true,
        });

        // Notify all changed nodes at once
        changedNodes.forEach((node) => originalNotify(node));
    }
}

/**
 * Get all observables (for debugging/inspection)
 */
export function getAllObservables(): Map<OnyxKey, ObservableNode> {
    return observableNodes;
}

/**
 * Clear all observables (useful for testing)
 */
export function clearAllObservables(): void {
    observableNodes.clear();
}

/**
 * Compute a derived value that automatically updates
 * When dependencies change, the compute function re-runs
 */
export function computed<T>(computeFn: () => T): Observable<T> {
    let cachedValue: T;
    let isDirty = true;
    const observers = new Set<Observer>();

    // Create a synthetic observable
    const node: ObservableNode<T> = {
        value: null as T,
        observers,
        version: 0,
    };

    // Observer that marks this computed as dirty when dependencies change
    const markDirty: Observer = () => {
        if (!isDirty) {
            isDirty = true;
            notifyObservers(node);
        }
    };

    const compute = () => {
        if (isDirty) {
            const prevObserver = currentObserver;
            currentObserver = markDirty;
            try {
                cachedValue = computeFn();
                node.value = cachedValue;
                isDirty = false;
            } finally {
                currentObserver = prevObserver;
            }
        }
        return cachedValue;
    };

    return {
        get(): T {
            if (currentObserver) {
                observers.add(currentObserver);
            }
            return compute();
        },

        set(): void {
            throw new Error('Cannot set a computed observable');
        },

        observe(observer: Observer): () => void {
            observers.add(observer);
            return () => observers.delete(observer);
        },

        peek(): T {
            return compute();
        },
    };
}

import {deepEqual, shallowEqual} from 'fast-equals';
import {useEffect, useRef, useSyncExternalStore} from 'react';
import type {DependencyList} from 'react';
import OnyxCache from './OnyxCache';
import OnyxUtils from './OnyxUtils';
import type {OnyxKey, OnyxValue} from './types';
import usePrevious from './usePrevious';
import useLiveRef from './useLiveRef';

type UseOnyxSelector<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>> = (data: OnyxValue<TKey> | undefined) => TReturnValue;

type UseOnyxOptions<TKey extends OnyxKey, TReturnValue> = {
    /**
     * Determines if this key in this subscription is safe to be evicted.
     */
    canEvict?: boolean;

    /**
     * If set to `false`, then no data will be prefilled into the component.
     * @deprecated This param is going to be removed soon. Use RAM-only keys instead.
     */
    initWithStoredValues?: boolean;

    /**
     * If set to `true`, the key can be changed dynamically during the component lifecycle.
     */
    allowDynamicKey?: boolean;

    /**
     * This will be used to subscribe to a subset of an Onyx key's data.
     * Using this setting on `useOnyx` can have very positive performance benefits because the component will only re-render
     * when the subset of data changes. Otherwise, any change of data on any property would normally
     * cause the component to re-render (and that can be expensive from a performance standpoint).
     * @see `useOnyx` cannot return `null` and so selector will replace `null` with `undefined` to maintain compatibility.
     */
    selector?: UseOnyxSelector<TKey, TReturnValue>;
};

type FetchStatus = 'loading' | 'loaded';

type ResultMetadata<TValue> = {
    status: FetchStatus;
};

type UseOnyxResult<TValue> = [NonNullable<TValue> | undefined, ResultMetadata<TValue>];

let nextEvictionBlockId = 0;

/**
 * Creates a memoized selector that uses deep equality to avoid unnecessary re-renders.
 * Returns the same output reference when the selector produces a deeply equal result.
 */
function createMemoizedSelector<TKey extends OnyxKey, TReturnValue>(
    selector: UseOnyxSelector<TKey, TReturnValue>,
    depsRef: {current: DependencyList},
): UseOnyxSelector<TKey, TReturnValue> {
    let lastInput: OnyxValue<TKey> | undefined;
    let lastOutput: TReturnValue;
    let lastDependencies: DependencyList = [];
    let hasComputed = false;

    return (input: OnyxValue<TKey> | undefined): TReturnValue => {
        const currentDependencies = depsRef.current;
        const dependenciesChanged = !shallowEqual(lastDependencies, currentDependencies);

        if (!hasComputed || lastInput !== input || dependenciesChanged) {
            const newOutput = selector(input);

            if (!hasComputed || !deepEqual(lastOutput, newOutput) || dependenciesChanged) {
                lastInput = input;
                lastOutput = newOutput;
                lastDependencies = [...currentDependencies];
                hasComputed = true;
            }
        }

        return lastOutput;
    };
}

function useOnyx<TKey extends OnyxKey, TReturnValue = OnyxValue<TKey>>(
    key: TKey,
    options?: UseOnyxOptions<TKey, TReturnValue>,
    dependencies: DependencyList = [],
): UseOnyxResult<TReturnValue> {
    const previousKey = usePrevious(key);
    const selector = options?.selector;
    const currentDependenciesRef = useLiveRef(dependencies);

    // Stable eviction block ID per hook instance
    const evictionBlockIdRef = useRef(`useOnyx_${nextEvictionBlockId++}`);

    // For initWithStoredValues: false — track whether we've received an update
    const hasReceivedUpdateRef = useRef(options?.initWithStoredValues !== false);

    // Result memoization for useSyncExternalStore referential stability
    const resultRef = useRef<UseOnyxResult<TReturnValue>>();
    const previousValueRef = useRef<TReturnValue | undefined>();

    // Memoized selector — recreated only when selector reference changes.
    // Uses a ref instead of useMemo because this is a stateful closure (tracks last input/output).
    const selectorRef = useRef<UseOnyxSelector<TKey, TReturnValue> | undefined>(undefined);
    const memoizedSelectorRef = useRef<UseOnyxSelector<TKey, TReturnValue> | null>(null);

    if (selector !== selectorRef.current) {
        selectorRef.current = selector;
        memoizedSelectorRef.current = selector ? createMemoizedSelector(selector, currentDependenciesRef) : null;
    }

    // Dynamic key validation
    useEffect(() => {
        if (options?.allowDynamicKey || previousKey === key) {
            return;
        }

        try {
            const previousCollectionKey = OnyxUtils.splitCollectionMemberKey(previousKey)[0];
            const collectionKey = OnyxUtils.splitCollectionMemberKey(key)[0];

            if (OnyxUtils.isCollectionMemberKey(previousCollectionKey, previousKey) && OnyxUtils.isCollectionMemberKey(collectionKey, key) && previousCollectionKey === collectionKey) {
                return;
            }
        } catch (e) {
            throw new Error(
                `'${previousKey}' key can't be changed to '${key}'. useOnyx() only supports dynamic keys if they are both collection member keys from the same collection e.g. from 'collection_id1' to 'collection_id2'.`,
            );
        }

        throw new Error(
            `'${previousKey}' key can't be changed to '${key}'. useOnyx() only supports dynamic keys if they are both collection member keys from the same collection e.g. from 'collection_id1' to 'collection_id2'.`,
        );
    }, [previousKey, key, options?.allowDynamicKey]);

    // Handle canEvict changes
    useEffect(() => {
        if (options?.canEvict === undefined || !OnyxCache.isEvictableKey(key)) {
            return;
        }

        if (options.canEvict) {
            OnyxCache.removeEvictionBlock(key, evictionBlockIdRef.current);
        } else {
            OnyxCache.addEvictionBlock(key, evictionBlockIdRef.current);
        }
    }, [key, options?.canEvict]);

    const getSnapshot = (): UseOnyxResult<TReturnValue> => {
        // If initWithStoredValues is false and no update received yet, return undefined
        if (!hasReceivedUpdateRef.current) {
            if (!resultRef.current) {
                resultRef.current = [undefined, {status: 'loaded'}];
            }
            return resultRef.current;
        }

        const rawValue = OnyxUtils.tryGetCachedValue(key) as OnyxValue<TKey>;
        const memoizedSelector = memoizedSelectorRef.current;
        const selectedValue = memoizedSelector ? memoizedSelector(rawValue) : rawValue;
        const newValue = (selectedValue ?? undefined) as TReturnValue | undefined;

        // Return same reference if value hasn't changed (referential stability for useSyncExternalStore)
        if (resultRef.current) {
            let areValuesEqual: boolean;
            if (memoizedSelector) {
                // Memoized selectors handle deep equality internally — reference check is sufficient
                areValuesEqual = previousValueRef.current === newValue;
            } else {
                areValuesEqual = shallowEqual(previousValueRef.current, newValue);
            }

            if (areValuesEqual) {
                return resultRef.current;
            }
        }

        previousValueRef.current = newValue;
        resultRef.current = [newValue, {status: 'loaded'}];
        return resultRef.current;
    };

    const subscribe = (onStoreChange: () => void): (() => void) => {
        if (options?.canEvict !== undefined && !OnyxCache.isEvictableKey(key)) {
            throw new Error(`canEvict can't be used on key '${key}'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({evictableKeys: []}).`);
        }

        const unsubscribe = OnyxUtils.subscribeToKeyEvents(key, () => {
            hasReceivedUpdateRef.current = true;
            onStoreChange();
        });

        // Handle eviction blocklist
        if (options?.canEvict === false && OnyxCache.isEvictableKey(key)) {
            OnyxCache.addEvictionBlock(key, evictionBlockIdRef.current);
        }

        return () => {
            unsubscribe();
            OnyxCache.removeEvictionBlock(key, evictionBlockIdRef.current);
        };
    };

    return useSyncExternalStore(subscribe, getSnapshot);
}

export default useOnyx;

export type {FetchStatus, ResultMetadata, UseOnyxResult, UseOnyxOptions, UseOnyxSelector};

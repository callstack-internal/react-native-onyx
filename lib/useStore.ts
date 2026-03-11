import {deepEqual} from 'fast-equals';
import {useSyncExternalStore} from 'react';
import OnyxCache from './OnyxCache';
import OnyxUtils from './OnyxUtils';
import type {OnyxKey, OnyxValue} from './types';

type OnyxState = Record<OnyxKey, OnyxValue<OnyxKey>>;

// External memoization cache keyed by selector identity.
// This lives outside React's render cycle so no ref access rules are violated.
const selectorCache = new WeakMap<(state: OnyxState) => unknown, {value: unknown}>();

function useStore<TResult>(selector: (state: OnyxState) => TResult): TResult {
    const getSnapshot = (): TResult => {
        const state = OnyxCache.getStoreSnapshot();
        const nextResult = selector(state);

        const cached = selectorCache.get(selector) as {value: TResult} | undefined;
        if (cached && deepEqual(cached.value, nextResult)) {
            return cached.value;
        }

        selectorCache.set(selector, {value: nextResult});
        return nextResult;
    };

    return useSyncExternalStore(OnyxUtils.subscribeToGlobalStore, getSnapshot);
}

export default useStore;

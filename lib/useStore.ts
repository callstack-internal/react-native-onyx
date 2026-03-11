import {deepEqual} from 'fast-equals';
import {useRef, useSyncExternalStore} from 'react';
import OnyxCache from './OnyxCache';
import OnyxUtils from './OnyxUtils';
import type {CollectionKeyBase, KeyValueMapping} from './types';

type OnyxState = {
    [TKey in keyof KeyValueMapping]?: KeyValueMapping[TKey];
};

type OnyxCollections = {
    [TKey in CollectionKeyBase]?: Record<string, KeyValueMapping[`${TKey}${string}`] | undefined>;
};

function useStore<TResult>(selector: (state: OnyxState, collections: OnyxCollections) => TResult): TResult {
    const cachedRef = useRef<{value: TResult} | undefined>(undefined);

    const getSnapshot = (): TResult => {
        const state = OnyxCache.getStoreSnapshot();
        const collections = OnyxCache.getCollectionSnapshot();
        const nextResult = selector(state, collections);

        if (cachedRef.current && deepEqual(cachedRef.current.value, nextResult)) {
            return cachedRef.current.value;
        }

        cachedRef.current = {value: nextResult};
        return nextResult;
    };

    return useSyncExternalStore(OnyxUtils.subscribeToGlobalStore, getSnapshot);
}

export default useStore;
export type {OnyxState, OnyxCollections};

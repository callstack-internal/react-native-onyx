import {deepEqual} from 'fast-equals';
import {useRef, useSyncExternalStore} from 'react';
import OnyxCache from './OnyxCache';
import OnyxUtils from './OnyxUtils';
import type {OnyxKey, OnyxValue} from './types';

type OnyxState = Record<OnyxKey, OnyxValue<OnyxKey>>;

function useStore<TResult>(selector: (state: OnyxState) => TResult): TResult {
    const cachedRef = useRef<{value: TResult} | undefined>(undefined);

    const getSnapshot = (): TResult => {
        const state = OnyxCache.getStoreSnapshot();
        const nextResult = selector(state);

        if (cachedRef.current && deepEqual(cachedRef.current.value, nextResult)) {
            return cachedRef.current.value;
        }

        cachedRef.current = {value: nextResult};
        return nextResult;
    };

    return useSyncExternalStore(OnyxUtils.subscribeToGlobalStore, getSnapshot);
}

export default useStore;

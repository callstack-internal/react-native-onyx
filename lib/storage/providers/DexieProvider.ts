import Dexie from 'dexie';
import type {EntityTable} from 'dexie';
import type StorageProvider from './types';
import type {OnyxKey, OnyxValue} from '../../types';

type DexieDatabase = Dexie & {
    keyvaluepairs: EntityTable<OnyxValue<OnyxKey>, OnyxKey>; // TODO typings
};

let db: DexieDatabase;

const provider: StorageProvider = {
    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'DexieProvider',
    /**
     * Initializes the storage provider
     */
    init() {
        db = new Dexie('OnyxDB') as DexieDatabase;
    },
    setItem: (key, value) => {
        if (value === null) {
            provider.removeItem(key);
        }

        return db.keyvaluepairs.put(value, key);
    },
    // multiGet: (keys) => db.keyvaluepairs.bulkGet(keys),
    // multiMerge: (pairs) => db.keyvaluepairs.bulkPut(items, keys, options),
    mergeItem(key, _deltaChanges, preMergedValue) {
        // Since Onyx also merged the existing value with the changes, we can just set the value directly
        return provider.setItem(key, preMergedValue);
    },
    // multiSet: (pairs) => {},
    clear: () => db.keyvaluepairs.clear(),
    getAllKeys: () => db.keyvaluepairs.toCollection().keys(),
    getItem: (key) => db.keyvaluepairs.get(key),
    removeItem: (key) => db.keyvaluepairs.delete(key),
    removeItems: (keys) => db.keyvaluepairs.bulkDelete(keys),
    getDatabaseSize() {
        return Promise.resolve({
            bytesUsed: 0,
            bytesRemaining: 0,
        });
    },
};

export default provider;

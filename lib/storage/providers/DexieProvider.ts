// TODO: Fix types
import Dexie from 'dexie';
import utils from '../../utils';
import type StorageProvider from './types';
import type {OnyxKey, OnyxValue} from '../../types';

class OnyxDatabase extends Dexie {
    keyvaluepairs!: Dexie.Table<OnyxValue<OnyxKey>, OnyxKey>;

    constructor() {
        super('OnyxDB');
        this.version(0.1).stores({
            keyvaluepairs: '',
        });
    }
}

let db: OnyxDatabase;

const initDB = () => {
    if (!db) {
        db = new OnyxDatabase();
        return db.open();
    }
    return Promise.resolve();
};

const provider: StorageProvider = {
    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'DexieProvider',
    init: initDB,

    setItem: (key, value) => {
        if (value === null) {
            return provider.removeItem(key);
        }
        return db.keyvaluepairs.put(value, key);
    },
    multiGet: (keysParam) => {
        return db.keyvaluepairs.bulkGet(keysParam).then((results) => {
            return results.map((result, index) => [keysParam[index], result ?? null]);
        });
    },
    multiMerge: (pairs) => {
        return db.transaction('rw', db.keyvaluepairs, () => {
            return Promise.all(
                pairs.map(([key, value]) => {
                    if (value === null) {
                        return provider.removeItem(key);
                    }
                    return db.keyvaluepairs.get(key).then((existingItem) => {
                        const newValue = utils.fastMerge(existingItem as Record<string, unknown>, value as Record<string, unknown>);
                        return db.keyvaluepairs.put(newValue, key);
                    });
                }),
            );
        });
    },
    mergeItem: (key, _deltaChanges, preMergedValue) => {
        // Since Onyx also merged the existing value with the changes, we can just set the value directly
        return provider.setItem(key, preMergedValue);
    },
    multiSet: (pairs) => {
        const pairsWithoutNull = pairs.filter(([, value]) => value !== null);
        return db.keyvaluepairs.bulkPut(
            pairsWithoutNull.map(([, value]) => value),
            pairsWithoutNull.map(([key]) => key),
        );
    },
    clear: () => {
        return db.keyvaluepairs.clear();
    },
    getAllKeys: () => {
        return db.keyvaluepairs.toCollection().keys();
    },
    getItem: (key) => {
        return db.keyvaluepairs.get(key).then((result) => {
            return result ?? null;
        });
    },
    removeItem: (key) => {
        return db.keyvaluepairs.delete(key);
    },
    removeItems: (keysParam) => {
        return db.keyvaluepairs.bulkDelete(keysParam);
    },
    getDatabaseSize: () => {
        if (!window.navigator || !window.navigator.storage) {
            return Promise.reject(new Error('StorageManager browser API unavailable'));
        }

        return window.navigator.storage
            .estimate()
            .then((estimate) => {
                return {
                    bytesUsed: estimate.usage ?? 0,
                    bytesRemaining: (estimate.quota ?? 0) - (estimate.usage ?? 0),
                };
            })
            .catch((error) => {
                throw new Error(`Unable to estimate web storage quota. Original error: ${error}`);
            });
    },
};

export default provider;

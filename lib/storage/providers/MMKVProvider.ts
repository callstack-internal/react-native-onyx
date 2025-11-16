/* eslint-disable @lwc/lwc/no-async-await */
import {createMMKV} from 'react-native-mmkv';
import type {MMKV} from 'react-native-mmkv';
import utils from '../../utils';
import type StorageProvider from './types';
import type {StorageKeyValuePair} from './types';
import * as GlobalSettings from '../../GlobalSettings';
import decorateWithMetrics from '../../metrics';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stringifyJSON(data: any, replacer?: (key: string, value: any) => any): string {
    return JSON.stringify(data, replacer);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJSON(text: string): any {
    return JSON.parse(text);
}

let db: MMKV;

const provider: StorageProvider = {
    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'MMKVProvider',
    /**
     * Initializes the storage provider
     */
    init() {
        db = createMMKV();
    },
    async getItem(key) {
        const result = db.getString(key);

        if (result === null || result === undefined) {
            return null;
        }

        return parseJSON(result);
    },
    async multiGet(keys) {
        const results: StorageKeyValuePair[] = [];

        for (const key of keys) {
            const result = db.getString(key);
            results.push([key, result !== null && result !== undefined ? parseJSON(result) : null]);
        }

        return results;
    },
    async setItem(key, value) {
        if (value === null || value === undefined) {
            this.removeItem(key);
            return;
        }

        db.set(key, stringifyJSON(value));
    },
    async multiSet(pairs) {
        for (const pair of pairs) {
            if (pair[1] === null || pair[1] === undefined) {
                this.removeItem(pair[0]);
                // eslint-disable-next-line no-continue
                continue;
            }

            db.set(pair[0], stringifyJSON(pair[1]));
        }
    },
    async multiMerge(pairs) {
        const keys = pairs.map((p) => p[0]);

        // multiGet logic
        const values: StorageKeyValuePair[] = [];

        for (const key of keys) {
            const result = db.getString(key);
            values.push([key, result !== null && result !== undefined ? parseJSON(result) : null]);
        }
        // ------

        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < values.length; i++) {
            const value = values[i];

            if (value[1] === null || value[1] === undefined) {
                this.removeItem(value[0]);
                // eslint-disable-next-line no-continue
                continue;
            }

            const newValue = utils.fastMerge(value[1] as Record<string, unknown>, pairs[i][1] as Record<string, unknown>, {
                shouldRemoveNestedNulls: true,
                objectRemovalMode: 'replace',
            }).result;

            // setItem logic
            if (newValue === null || newValue === undefined) {
                this.removeItem(value[0]);
                return;
            }

            db.set(value[0], stringifyJSON(value));
            // ------
        }
    },
    async mergeItem(_key, change, replaceNullPatches) {
        const pairs: StorageKeyValuePair[] = [[_key, change, replaceNullPatches]];

        // multiMerge logic
        const keys = pairs.map((p) => p[0]);

        const values: StorageKeyValuePair[] = [];

        for (const key of keys) {
            const result = db.getString(key);
            values.push([key, result !== null && result !== undefined ? parseJSON(result) : null]);
        }

        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < values.length; i++) {
            const value = values[i];

            if (value[1] === null || value[1] === undefined) {
                this.removeItem(value[0]);
                // eslint-disable-next-line no-continue
                continue;
            }

            const newValue = utils.fastMerge(value[1] as Record<string, unknown>, pairs[i][1] as Record<string, unknown>, {
                shouldRemoveNestedNulls: true,
                objectRemovalMode: 'replace',
            }).result;

            if (newValue === null || newValue === undefined) {
                this.removeItem(value[0]);
                return;
            }

            db.set(value[0], stringifyJSON(value));
        }
        // ------
    },
    async getAllKeys() {
        return db.getAllKeys();
    },
    async removeItem(key) {
        db.remove(key);
    },
    async removeItems(keys) {
        for (const key of keys) {
            this.removeItem(key);
        }
    },
    async clear() {
        db.clearAll();
    },
    async getDatabaseSize() {
        return {bytesUsed: db.size, bytesRemaining: Infinity};
    },
};

GlobalSettings.addGlobalSettingsChangeListener(({enablePerformanceMetrics}) => {
    if (!enablePerformanceMetrics) {
        return;
    }

    // Apply decorators
    provider.getItem = decorateWithMetrics(provider.getItem, 'MMKVProvider.getItem');
    provider.multiGet = decorateWithMetrics(provider.multiGet, 'MMKVProvider.multiGet');
    provider.setItem = decorateWithMetrics(provider.setItem, 'MMKVProvider.setItem');
    provider.multiSet = decorateWithMetrics(provider.multiSet, 'MMKVProvider.multiSet');
    provider.mergeItem = decorateWithMetrics(provider.mergeItem, 'MMKVProvider.mergeItem');
    provider.multiMerge = decorateWithMetrics(provider.multiMerge, 'MMKVProvider.multiMerge');
    provider.removeItem = decorateWithMetrics(provider.removeItem, 'MMKVProvider.removeItem');
    provider.removeItems = decorateWithMetrics(provider.removeItems, 'MMKVProvider.removeItems');
    provider.clear = decorateWithMetrics(provider.clear, 'MMKVProvider.clear');
    provider.getAllKeys = decorateWithMetrics(provider.getAllKeys, 'MMKVProvider.getAllKeys');
    // @ts-expect-error Reassign
    stringifyJSON = decorateWithMetrics(stringifyJSON, 'SQLiteProvider.stringifyJSON');
    // @ts-expect-error Reassign
    parseJSON = decorateWithMetrics(parseJSON, 'SQLiteProvider.parseJSON');
});

export default provider;

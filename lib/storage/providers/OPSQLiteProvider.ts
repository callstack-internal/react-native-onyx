/**
 * The SQLiteStorage provider stores everything in a key/value store by
 * converting the value to a JSON string
 */
import {getFreeDiskStorage} from 'react-native-device-info';
import type {DB, PreparedStatement, SQLBatchTuple} from '@op-engineering/op-sqlite';
import {open} from '@op-engineering/op-sqlite';
import type {FastMergeReplaceNullPatch} from '../../utils';
import utils from '../../utils';
import type StorageProvider from './types';
import type {StorageKeyList, StorageKeyValuePair} from './types';
import * as GlobalSettings from '../../GlobalSettings';
import decorateWithMetrics from '../../metrics';

/**
 * The type of the key-value pair stored in the SQLite database
 * @property record_key - the key of the record
 * @property valueJSON - the value of the record in JSON string format
 */
type OnyxSQLiteKeyValuePair = {
    record_key: string;
    valueJSON: string;
};

/**
 * The result of the `PRAGMA page_size`, which gets the page size of the SQLite database
 */
type PageSizeResult = {
    page_size: number;
};

/**
 * The result of the `PRAGMA page_count`, which gets the page count of the SQLite database
 */
type PageCountResult = {
    page_count: number;
};

const DB_NAME = 'OnyxDB';
let db: DB;
let getItemStatement: PreparedStatement;
let getAllKeysStatement: PreparedStatement;

/**
 * Prevents the stringifying of the object markers.
 */
function objectMarkRemover(key: string, value: unknown) {
    if (key === utils.ONYX_INTERNALS__REPLACE_OBJECT_MARK) return undefined;
    return value;
}

/**
 * Transforms the replace null patches into SQL queries to be passed to JSON_REPLACE.
 */
function generateJSONReplaceSQLQueries(key: string, patches: FastMergeReplaceNullPatch[]): string[][] {
    const queries = patches.map(([pathArray, value]) => {
        const jsonPath = `$.${pathArray.join('.')}`;
        return [jsonPath, stringifyJSON(value), key];
    });

    return queries;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stringifyJSON(data: any, replacer?: (key: string, value: any) => any): string {
    return JSON.stringify(data, replacer);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJSON(text: string): any {
    return JSON.parse(text);
}

const provider: StorageProvider = {
    /**
     * The name of the provider that can be printed to the logs
     */
    name: 'OPSQLiteProvider',
    /**
     * Initializes the storage provider
     */
    init() {
        db = open({name: DB_NAME});

        db.execute('CREATE TABLE IF NOT EXISTS keyvaluepairs (record_key TEXT NOT NULL PRIMARY KEY , valueJSON JSON NOT NULL) WITHOUT ROWID;');

        // All of the 3 pragmas below were suggested by SQLite team.
        // You can find more info about them here: https://www.sqlite.org/pragma.html
        db.execute('PRAGMA CACHE_SIZE=-20000;');
        db.execute('PRAGMA synchronous=NORMAL;');
        db.execute('PRAGMA journal_mode=WAL;');
        getItemStatement = db.prepareStatement('SELECT record_key, valueJSON FROM keyvaluepairs WHERE record_key = ?;');
        getAllKeysStatement = db.prepareStatement('SELECT record_key FROM keyvaluepairs;');
    },
    getItem(key) {
        return getItemStatement.bind([key]).then(() =>
            getItemStatement.execute().then(({rows}) => {
                if (!rows || rows?.length === 0) {
                    return null;
                }
                const result = rows.at(0);

                if (result == null) {
                    return null;
                }

                return parseJSON(result.valueJSON as string);
            }),
        );
    },
    multiGet(keys) {
        const placeholders = keys.map(() => '?').join(',');
        const command = `SELECT record_key, valueJSON FROM keyvaluepairs WHERE record_key IN (${placeholders});`;
        return db.execute(command, keys).then(({rows}) => {
            // eslint-disable-next-line no-underscore-dangle
            const result = rows?.map((row) => [row.record_key, parseJSON(row.valueJSON as string)]);
            return (result ?? []) as StorageKeyValuePair[];
        });
    },
    setItem(key, value) {
        return db.execute('REPLACE INTO keyvaluepairs (record_key, valueJSON) VALUES (?, ?);', [key, stringifyJSON(value)]).then(() => undefined);
    },
    multiSet(pairs) {
        const query = 'REPLACE INTO keyvaluepairs (record_key, valueJSON) VALUES (?, json(?));';
        const commands: SQLBatchTuple[] = pairs.map((pair) => [query, [pair[0], stringifyJSON(pair[1] === undefined ? null : pair[1])]]);
        if (utils.isEmptyObject(commands)) {
            return Promise.resolve();
        }
        return db.executeBatch(commands).then(() => undefined);
    },
    multiMerge(pairs) {
        const commands: SQLBatchTuple[] = [];

        // Query to merge the change into the DB value.
        const patchQuery = `INSERT INTO keyvaluepairs (record_key, valueJSON)
            VALUES (:key, JSON(:value))
            ON CONFLICT DO UPDATE
            SET valueJSON = JSON_PATCH(valueJSON, JSON(:value));
        `;
        const patchQueryArguments: string[][] = [];

        // Query to fully replace the nested objects of the DB value.
        const replaceQuery = `UPDATE keyvaluepairs
            SET valueJSON = JSON_REPLACE(valueJSON, ?, JSON(?))
            WHERE record_key = ?;
        `;
        const replaceQueryArguments: string[][] = [];

        const nonNullishPairs = pairs.filter((pair) => pair[1] !== undefined);

        for (const [key, value, replaceNullPatches] of nonNullishPairs) {
            const changeWithoutMarkers = stringifyJSON(value, objectMarkRemover);
            patchQueryArguments.push([key, changeWithoutMarkers]);

            const patches = replaceNullPatches ?? [];
            if (patches.length > 0) {
                const queries = generateJSONReplaceSQLQueries(key, patches);

                if (queries.length > 0) {
                    replaceQueryArguments.push(...queries);
                }
            }
        }

        commands.push([patchQuery, patchQueryArguments]);
        if (replaceQueryArguments.length > 0) {
            commands.push([replaceQuery, replaceQueryArguments]);
        }

        return db.executeBatch(commands).then(() => undefined);
    },
    mergeItem(key, change, replaceNullPatches) {
        // Since Onyx already merged the existing value with the changes, we can just set the value directly.
        return this.multiMerge([[key, change, replaceNullPatches]]);
    },
    getAllKeys: () => {
        return getAllKeysStatement.execute().then(({rows}) => {
            const result = rows?.map((row) => row.record_key);
            return (result ?? []) as StorageKeyList;
        });
    },
    removeItem: (key) => {
        return db.execute('DELETE FROM keyvaluepairs WHERE record_key = ?;', [key]).then(() => undefined);
    },
    removeItems: (keys) => {
        const placeholders = keys.map(() => '?').join(',');
        const query = `DELETE FROM keyvaluepairs WHERE record_key IN (${placeholders});`;
        return db.execute(query, keys).then(() => undefined);
    },
    clear: () => {
        return db.execute('DELETE FROM keyvaluepairs;', []).then(() => undefined);
    },
    getDatabaseSize() {
        return Promise.all([db.execute('PRAGMA page_size;'), db.execute('PRAGMA page_count;'), getFreeDiskStorage()]).then(([pageSizeResult, pageCountResult, bytesRemaining]) => {
            const pageSize = (pageSizeResult.rows?.at(0) as PageSizeResult | undefined)?.page_size ?? 0;
            const pageCount = (pageCountResult.rows?.at(0) as PageCountResult | undefined)?.page_count ?? 0;
            return {
                bytesUsed: pageSize * pageCount,
                bytesRemaining,
            };
        });
    },
};

GlobalSettings.addGlobalSettingsChangeListener(({enablePerformanceMetrics}) => {
    if (!enablePerformanceMetrics) {
        return;
    }

    // Apply decorators
    provider.getItem = decorateWithMetrics(provider.getItem, 'OPSQLiteProvider.getItem');
    provider.multiGet = decorateWithMetrics(provider.multiGet, 'OPSQLiteProvider.multiGet');
    provider.setItem = decorateWithMetrics(provider.setItem, 'OPSQLiteProvider.setItem');
    provider.multiSet = decorateWithMetrics(provider.multiSet, 'OPSQLiteProvider.multiSet');
    provider.mergeItem = decorateWithMetrics(provider.mergeItem, 'OPSQLiteProvider.mergeItem');
    provider.multiMerge = decorateWithMetrics(provider.multiMerge, 'OPSQLiteProvider.multiMerge');
    provider.removeItem = decorateWithMetrics(provider.removeItem, 'OPSQLiteProvider.removeItem');
    provider.removeItems = decorateWithMetrics(provider.removeItems, 'OPSQLiteProvider.removeItems');
    provider.clear = decorateWithMetrics(provider.clear, 'OPSQLiteProvider.clear');
    provider.getAllKeys = decorateWithMetrics(provider.getAllKeys, 'OPSQLiteProvider.getAllKeys');
    // @ts-expect-error Reassign
    generateJSONReplaceSQLQueries = decorateWithMetrics(generateJSONReplaceSQLQueries, 'OPSQLiteProvider.generateJSONReplaceSQLQueries');
    // @ts-expect-error Reassign
    stringifyJSON = decorateWithMetrics(stringifyJSON, 'OPSQLiteProvider.stringifyJSON');
    // @ts-expect-error Reassign
    parseJSON = decorateWithMetrics(parseJSON, 'OPSQLiteProvider.parseJSON');
});

export default provider;
export type {OnyxSQLiteKeyValuePair};

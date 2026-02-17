/* eslint-disable no-console */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error node:sqlite runtime exists, but typings may be unavailable in this repo's TS setup.
import {DatabaseSync} from 'node:sqlite';

type SQLiteRow = Record<string, unknown>;
type SQLiteStatement = {
    run: (...args: unknown[]) => void;
    get: () => SQLiteRow;
    all: () => SQLiteRow[];
};

type SQLiteDatabase = {
    exec: (sql: string) => void;
    prepare: (sql: string) => SQLiteStatement;
    close: () => void;
};

const TEST_KEY_PREFIX = 'dbSizeSynthetic_';
const KEY_COUNT = 250;
const BATCHES_COUNT = 120;

type ScenarioResult = {
    bytesUsed: number;
    onDiskBytes: number;
    nestedNullCount: number;
    keysCount: number;
    dbPath: string;
};

function buildPayload(batchIndex: number, keyIndex: number) {
    return {
        id: `${batchIndex}_${keyIndex}`,
        owner: {
            login: `user_${keyIndex}@example.com`,
            locale: keyIndex % 3 === 0 ? null : 'en',
            details: {
                timezone: batchIndex % 2 === 0 ? null : 'UTC',
                profile: {
                    avatar: keyIndex % 4 === 0 ? null : `https://example.com/${batchIndex}/${keyIndex}.png`,
                    status: batchIndex % 5 === 0 ? null : 'active',
                },
            },
        },
        policy: {
            name: `Policy ${keyIndex}`,
            roles: {
                admin: keyIndex % 11 === 0 ? null : keyIndex % 2 === 0,
                auditor: batchIndex % 7 === 0 ? null : keyIndex % 3 === 0,
            },
            limits: {
                monthly: 2000 + keyIndex,
                yearly: batchIndex % 6 === 0 ? null : 24000 + keyIndex,
            },
        },
        chat: {
            lastMessage: {
                text: `Message ${batchIndex}-${keyIndex}`,
                html: batchIndex % 8 === 0 ? null : `<strong>${batchIndex}-${keyIndex}</strong>`,
                metadata: {
                    edited: batchIndex % 9 === 0 ? null : false,
                    reactions: keyIndex % 5 === 0 ? null : [{emoji: '+1', count: (keyIndex % 4) + 1}],
                },
            },
            draftMessage: keyIndex % 10 === 0 ? null : `Draft ${batchIndex}-${keyIndex}`,
        },
    };
}

function removeNestedNullValues(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => removeNestedNullValues(item));
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
        const transformed = removeNestedNullValues(nested);
        if (transformed !== null) {
            output[key] = transformed;
        }
    }
    return output;
}

function countNestedNulls(value: unknown): number {
    if (value === null) {
        return 1;
    }

    if (Array.isArray(value)) {
        return value.reduce((count, item) => count + countNestedNulls(item), 0);
    }

    if (!value || typeof value !== 'object') {
        return 0;
    }

    return Object.values(value).reduce((count, item) => count + countNestedNulls(item), 0);
}

function bytesOnDiskForSqlite(dbPath: string): number {
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;

    const dbBytes = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    const walBytes = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;
    const shmBytes = fs.existsSync(shmPath) ? fs.statSync(shmPath).size : 0;

    return dbBytes + walBytes + shmBytes;
}

function readNumericPragma(db: SQLiteDatabase, pragmaSql: string, fieldName: string): number {
    const row = db.prepare(pragmaSql).get();
    const value = row[fieldName];

    if (typeof value !== 'number') {
        throw new Error(`Expected numeric PRAGMA field "${fieldName}", got ${String(value)}`);
    }

    return value;
}

function runScenario({removeNestedNulls}: {removeNestedNulls: boolean}): ScenarioResult {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onyx-sqlite-size-'));
    const dbPath = path.join(tmpDir, `OnyxDB-${removeNestedNulls ? 'with' : 'without'}.sqlite`);
    const db = new DatabaseSync(dbPath);

    db.exec('CREATE TABLE IF NOT EXISTS keyvaluepairs (record_key TEXT NOT NULL PRIMARY KEY, valueJSON JSON NOT NULL) WITHOUT ROWID;');
    db.exec('PRAGMA CACHE_SIZE=-20000;');
    db.exec('PRAGMA synchronous=NORMAL;');
    db.exec('PRAGMA journal_mode=WAL;');

    const writeStmt = db.prepare('REPLACE INTO keyvaluepairs (record_key, valueJSON) VALUES (?, json(?));');

    for (let batchIndex = 0; batchIndex < BATCHES_COUNT; batchIndex++) {
        db.exec('BEGIN IMMEDIATE TRANSACTION;');
        try {
            for (let keyIndex = 0; keyIndex < KEY_COUNT; keyIndex++) {
                const key = `${TEST_KEY_PREFIX}${keyIndex}`;
                const payload = buildPayload(batchIndex, keyIndex);
                const valueToStore = removeNestedNulls ? removeNestedNullValues(payload) : payload;
                writeStmt.run(key, JSON.stringify(valueToStore));
            }
            db.exec('COMMIT;');
        } catch (error) {
            db.exec('ROLLBACK;');
            throw error;
        }
    }

    db.exec('PRAGMA wal_checkpoint(FULL);');

    const pageSize = readNumericPragma(db, 'PRAGMA page_size;', 'page_size');
    const pageCount = readNumericPragma(db, 'PRAGMA page_count;', 'page_count');

    const rows = db.prepare('SELECT record_key, valueJSON FROM keyvaluepairs;').all();
    const nestedNullCount = rows.reduce((count: number, row: SQLiteRow) => {
        const valueJSON = row.valueJSON;
        if (typeof valueJSON !== 'string') {
            throw new Error('Expected valueJSON to be a string.');
        }
        return count + countNestedNulls(JSON.parse(valueJSON));
    }, 0);

    const result: ScenarioResult = {
        bytesUsed: pageSize * pageCount,
        onDiskBytes: bytesOnDiskForSqlite(dbPath),
        nestedNullCount,
        keysCount: rows.length,
        dbPath,
    };

    db.close();

    return result;
}

function main(): void {
    const withNullRemoval = runScenario({removeNestedNulls: true});
    const withoutNullRemoval = runScenario({removeNestedNulls: false});

    const bytesDelta = withoutNullRemoval.bytesUsed - withNullRemoval.bytesUsed;
    const onDiskDelta = withoutNullRemoval.onDiskBytes - withNullRemoval.onDiskBytes;
    const growthPct = (bytesDelta / withNullRemoval.bytesUsed) * 100;
    const onDiskGrowthPct = (onDiskDelta / withNullRemoval.onDiskBytes) * 100;

    console.info('[db-size-sqlite-synthetic] with removeNestedNullValues', withNullRemoval);
    console.info('[db-size-sqlite-synthetic] without removeNestedNullValues', withoutNullRemoval);
    console.info('[db-size-sqlite-synthetic] diff', {
        bytesDelta,
        growthPct: Number(growthPct.toFixed(2)),
        onDiskDelta,
        onDiskGrowthPct: Number(onDiskGrowthPct.toFixed(2)),
    });
}

main();

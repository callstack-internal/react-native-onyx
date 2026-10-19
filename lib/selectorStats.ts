/* eslint-disable no-underscore-dangle, no-undef, no-param-reassign -- measurement-only module, not for merge */
/**
 * Measurement-only instrumentation for useOnyx selectors (expensify-issues#3041). Off unless
 * `globalThis.__ONYX_SELECTOR_STATS__` is true; read results with `globalThis.__onyxSelectorStats.dump()`.
 */
import {deepEqual} from 'fast-equals';

import type {OnyxKey} from './types';

import OnyxKeys from './OnyxKeys';

type Access = 'whole' | 'unknown' | Set<PropertyKey>;

type Entry = {
    id: string;
    selector: string;
    key: string;
    /** Selector runs caused by a new snapshot. */
    dataRecomputes: number;
    /** Selector runs on the same snapshot (new selector identity resets the memo). */
    identityReruns: number;
    /** Data recomputes where every top-level member/field the selector read was `===` unchanged. */
    skippable: number;
    /** Data recomputes where the selector enumerated the whole input (Object.values etc.). */
    wholeInput: number;
    selectorMs: number;
    skippableMs: number;
    maxSelectorMs: number;
    deepEqualCalls: number;
    deepEqualRefHits: number;
    deepEqualMs: number;
    maxDeepEqualMs: number;
    /** deepEqual said not equal, so the hook re-rendered. */
    changed: number;
    /** Runs where another hook instance already ran this same selector function on this same input ref. */
    crossInstanceHits: number;
    crossInstanceMs: number;
    /** Same as above but matched by selector name, i.e. what a shared memo would save once inline selectors are hoisted. */
    crossInstanceByNameHits: number;
    crossInstanceByNameMs: number;
    /** By-name hits whose output deep-equals the first instance's, so captured args likely matched and sharing is valid. */
    crossInstanceByNameSameOutputHits: number;
    crossInstanceByNameSameOutputMs: number;
    source: string;
};

type InstanceState = {
    id: number;
    lastData: unknown;
    lastAccess: Access | undefined;
    hasRun: boolean;
};

const entries = new Map<string, Entry>();

// First instance that ran a selector on an input ref, keyed by function identity and by entry id (name@key).
let firstRunByFn = new WeakMap<(...args: never[]) => unknown, WeakMap<object, number>>();
let firstRunByName = new Map<string, WeakMap<object, {owner: number; result: unknown}>>();
let nextInstanceId = 1;

function isEnabled(): boolean {
    return (globalThis as {__ONYX_SELECTOR_STATS__?: boolean}).__ONYX_SELECTOR_STATS__ === true;
}

function isAccessTrackingEnabled(): boolean {
    return (globalThis as {__ONYX_SELECTOR_STATS_ACCESS__?: boolean}).__ONYX_SELECTOR_STATS_ACCESS__ !== false;
}

const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? () => performance.now() : () => Date.now();

function getEntry(key: OnyxKey, selector: (...args: never[]) => unknown): Entry {
    const keyBase = OnyxKeys.getCollectionKey(key) ?? key;
    const selectorName = selector.name || `anon:${String(selector).slice(0, 80).replaceAll(/\s+/g, ' ')}`;
    const id = `${selectorName}@${keyBase}`;
    let entry = entries.get(id);
    if (!entry) {
        entry = {
            id,
            selector: selectorName,
            key: keyBase,
            dataRecomputes: 0,
            identityReruns: 0,
            skippable: 0,
            wholeInput: 0,
            selectorMs: 0,
            skippableMs: 0,
            maxSelectorMs: 0,
            deepEqualCalls: 0,
            deepEqualRefHits: 0,
            deepEqualMs: 0,
            maxDeepEqualMs: 0,
            changed: 0,
            crossInstanceHits: 0,
            crossInstanceMs: 0,
            crossInstanceByNameHits: 0,
            crossInstanceByNameMs: 0,
            crossInstanceByNameSameOutputHits: 0,
            crossInstanceByNameSameOutputMs: 0,
            source: String(selector).slice(0, 300).replaceAll(/\s+/g, ' '),
        };
        entries.set(id, entry);
    }
    return entry;
}

/** Runs the selector on a Proxy of the input to record which top-level members/fields it reads. */
function recordAccess<T>(data: T, run: (data: T) => unknown): Access {
    if (data === null || typeof data !== 'object') {
        return 'unknown';
    }
    const touched = new Set<PropertyKey>();
    let whole = false;
    const proxy = new Proxy(data as object, {
        get(target, prop, receiver) {
            touched.add(prop);
            return Reflect.get(target, prop, receiver);
        },
        has(target, prop) {
            touched.add(prop);
            return Reflect.has(target, prop);
        },
        ownKeys(target) {
            whole = true;
            return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor(target, prop) {
            touched.add(prop);
            return Reflect.getOwnPropertyDescriptor(target, prop);
        },
    });
    try {
        run(proxy as T);
    } catch {
        return 'unknown';
    }
    return whole ? 'whole' : touched;
}

function accessUnchanged(access: Access | undefined, prev: unknown, next: unknown): boolean {
    if (!(access instanceof Set) || prev === null || next === null || typeof prev !== 'object' || typeof next !== 'object') {
        return false;
    }
    for (const prop of access) {
        if ((prev as Record<PropertyKey, unknown>)[prop] !== (next as Record<PropertyKey, unknown>)[prop]) {
            return false;
        }
    }
    return true;
}

function createInstanceState(): InstanceState {
    return {id: nextInstanceId++, lastData: undefined, lastAccess: undefined, hasRun: false};
}

function recordCrossInstance(entry: Entry, selector: (...args: never[]) => unknown, state: InstanceState, data: unknown, result: unknown, elapsed: number): void {
    if (data === null || typeof data !== 'object') {
        return;
    }
    let byFn = firstRunByFn.get(selector);
    if (!byFn) {
        byFn = new WeakMap();
        firstRunByFn.set(selector, byFn);
    }
    const fnOwner = byFn.get(data);
    if (fnOwner === undefined) {
        byFn.set(data, state.id);
    } else if (fnOwner !== state.id) {
        entry.crossInstanceHits++;
        entry.crossInstanceMs += elapsed;
    }

    let byName = firstRunByName.get(entry.id);
    if (!byName) {
        byName = new WeakMap();
        firstRunByName.set(entry.id, byName);
    }
    const first = byName.get(data);
    if (first === undefined) {
        byName.set(data, {owner: state.id, result});
        return;
    }
    if (first.owner === state.id) {
        return;
    }
    entry.crossInstanceByNameHits++;
    entry.crossInstanceByNameMs += elapsed;
    if (deepEqual(first.result, result)) {
        entry.crossInstanceByNameSameOutputHits++;
        entry.crossInstanceByNameSameOutputMs += elapsed;
    }
}

function measureSelect<TData, TResult>(key: OnyxKey, selector: (data: TData) => TResult, state: InstanceState, data: TData): TResult {
    const entry = getEntry(key, selector as (...args: never[]) => unknown);
    const start = now();
    const result = selector(data);
    const elapsed = now() - start;
    entry.selectorMs += elapsed;
    entry.maxSelectorMs = Math.max(entry.maxSelectorMs, elapsed);
    recordCrossInstance(entry, selector as (...args: never[]) => unknown, state, data, result, elapsed);

    if (state.hasRun && data === state.lastData) {
        entry.identityReruns++;
        return result;
    }

    if (state.hasRun) {
        entry.dataRecomputes++;
        if (state.lastAccess === 'whole') {
            entry.wholeInput++;
        } else if (accessUnchanged(state.lastAccess, state.lastData, data)) {
            entry.skippable++;
            entry.skippableMs += elapsed;
        }
    }

    // The Proxy dry run calls the selector a second time, which evicts single-entry memo caches inside it, so it can be turned off.
    state.lastAccess = isAccessTrackingEnabled() ? recordAccess(data, selector) : 'unknown';
    state.lastData = data;
    state.hasRun = true;
    return result;
}

function measureEqual<T>(key: OnyxKey, selector: (...args: never[]) => unknown, isEqual: (a: T, b: T) => boolean, a: T, b: T): boolean {
    const entry = getEntry(key, selector);
    entry.deepEqualCalls++;
    if (a === b) {
        entry.deepEqualRefHits++;
        return true;
    }
    const start = now();
    const equal = isEqual(a, b);
    const elapsed = now() - start;
    entry.deepEqualMs += elapsed;
    entry.maxDeepEqualMs = Math.max(entry.maxDeepEqualMs, elapsed);
    if (!equal) {
        entry.changed++;
    }
    return equal;
}

function round(value: number): number {
    return Math.round(value * 1000) / 1000;
}

function dump(): Entry[] {
    return [...entries.values()]
        .map((e) => ({
            ...e,
            selectorMs: round(e.selectorMs),
            skippableMs: round(e.skippableMs),
            maxSelectorMs: round(e.maxSelectorMs),
            deepEqualMs: round(e.deepEqualMs),
            maxDeepEqualMs: round(e.maxDeepEqualMs),
            crossInstanceMs: round(e.crossInstanceMs),
            crossInstanceByNameMs: round(e.crossInstanceByNameMs),
            crossInstanceByNameSameOutputMs: round(e.crossInstanceByNameSameOutputMs),
        }))
        .sort((a, b) => b.selectorMs + b.deepEqualMs - (a.selectorMs + a.deepEqualMs));
}

function totals() {
    const t = {
        selectors: entries.size,
        dataRecomputes: 0,
        identityReruns: 0,
        skippable: 0,
        wholeInput: 0,
        selectorMs: 0,
        skippableMs: 0,
        deepEqualCalls: 0,
        deepEqualRefHits: 0,
        deepEqualMs: 0,
        changed: 0,
        crossInstanceHits: 0,
        crossInstanceMs: 0,
        crossInstanceByNameHits: 0,
        crossInstanceByNameMs: 0,
        crossInstanceByNameSameOutputHits: 0,
        crossInstanceByNameSameOutputMs: 0,
    };
    for (const e of entries.values()) {
        t.dataRecomputes += e.dataRecomputes;
        t.identityReruns += e.identityReruns;
        t.skippable += e.skippable;
        t.wholeInput += e.wholeInput;
        t.selectorMs += e.selectorMs;
        t.skippableMs += e.skippableMs;
        t.deepEqualCalls += e.deepEqualCalls;
        t.deepEqualRefHits += e.deepEqualRefHits;
        t.deepEqualMs += e.deepEqualMs;
        t.changed += e.changed;
        t.crossInstanceHits += e.crossInstanceHits;
        t.crossInstanceMs += e.crossInstanceMs;
        t.crossInstanceByNameHits += e.crossInstanceByNameHits;
        t.crossInstanceByNameMs += e.crossInstanceByNameMs;
        t.crossInstanceByNameSameOutputHits += e.crossInstanceByNameSameOutputHits;
        t.crossInstanceByNameSameOutputMs += e.crossInstanceByNameSameOutputMs;
    }
    return {
        ...t,
        selectorMs: round(t.selectorMs),
        skippableMs: round(t.skippableMs),
        deepEqualMs: round(t.deepEqualMs),
        crossInstanceMs: round(t.crossInstanceMs),
        crossInstanceByNameMs: round(t.crossInstanceByNameMs),
        crossInstanceByNameSameOutputMs: round(t.crossInstanceByNameSameOutputMs),
    };
}

function reset(): void {
    entries.clear();
    firstRunByFn = new WeakMap();
    firstRunByName = new Map();
}

(globalThis as {__onyxSelectorStats?: unknown}).__onyxSelectorStats = {dump, totals, reset};

export {isEnabled, createInstanceState, measureSelect, measureEqual};
export type {InstanceState};

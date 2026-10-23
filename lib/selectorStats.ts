/* eslint-disable no-underscore-dangle, no-undef, no-param-reassign -- measurement-only module, not for merge */
/**
 * Measurement-only instrumentation for useOnyx selectors (expensify-issues#3041). Off unless
 * `globalThis.__ONYX_SELECTOR_STATS__` is true; read results with `globalThis.__onyxSelectorStats.dump()`.
 */
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
    /** Data recomputes a path filter would skip: every nested path read is unchanged (ref prune, Object.is leaf, object leaf by ref). */
    pathSkippable: number;
    /** Same, but object leaves compared with deepEqual (survives Onyx.set / cross-tab ref churn). */
    pathSkippableDeep: number;
    pathSkippableMs: number;
    /** Like pathSkippable, but an enumerated node only fires on key add/remove (Legend-State "shallow"), its read children still checked. */
    shallowSkippable: number;
    shallowSkippableMs: number;
    /** Time spent recording paths through the tracking Proxy (cost an implicit tracker pays per run). */
    trackMs: number;
    trackRuns: number;
    /** Distinct paths read on the last run (registry size proxy). */
    lastPathCount: number;
    maxPathCount: number;
    selectorMs: number;
    skippableMs: number;
    maxSelectorMs: number;
    deepEqualCalls: number;
    deepEqualRefHits: number;
    deepEqualMs: number;
    maxDeepEqualMs: number;
    /** deepEqual said not equal, so the hook re-rendered. */
    changed: number;
};

type InstanceState = {
    lastData: unknown;
    lastAccess: Access | undefined;
    lastPaths: PathAccess | undefined;
    hasRun: boolean;
};

/** Leaf paths read by a selector run. `refPaths` are nodes compared by reference (enumerated or read as a whole object). */
type PathAccess = {leafPaths: PropertyKey[][]; refPaths: PropertyKey[][]} | 'unknown';

const entries = new Map<string, Entry>();

function isEnabled(): boolean {
    return (globalThis as {__ONYX_SELECTOR_STATS__?: boolean}).__ONYX_SELECTOR_STATS__ === true;
}

/** Dispatch/listener timing only, without the selector Proxy dry-runs (low overhead, for A/B runs). */
function isTimingEnabled(): boolean {
    const g = globalThis as {__ONYX_SELECTOR_STATS__?: boolean; __ONYX_DISPATCH_TIMING__?: boolean};
    return g.__ONYX_SELECTOR_STATS__ === true || g.__ONYX_DISPATCH_TIMING__ === true;
}

const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? () => performance.now() : () => Date.now();

function getEntry(key: OnyxKey, selector: (...args: never[]) => unknown): Entry {
    const keyBase = OnyxKeys.getCollectionKey(key) ?? key;
    const selectorName = selector.name && !/^(t\d+|_temp\d*|selector)$/.test(selector.name) ? selector.name : `${selector.name || 'anon'}:${String(selector).slice(0, 160).replaceAll(/\s+/g, ' ')}`;
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
            pathSkippable: 0,
            pathSkippableDeep: 0,
            pathSkippableMs: 0,
            shallowSkippable: 0,
            shallowSkippableMs: 0,
            trackMs: 0,
            trackRuns: 0,
            lastPathCount: 0,
            maxPathCount: 0,
            selectorMs: 0,
            skippableMs: 0,
            maxSelectorMs: 0,
            deepEqualCalls: 0,
            deepEqualRefHits: 0,
            deepEqualMs: 0,
            maxDeepEqualMs: 0,
            changed: 0,
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

type PathNode = {children: Map<PropertyKey, PathNode>; enumerated: boolean};

/** Runs the selector on a recursive tracking Proxy and returns the trie of paths it read. */
function recordPaths<T>(data: T, run: (data: T) => unknown): PathAccess {
    if (data === null || typeof data !== 'object') {
        return 'unknown';
    }
    const root: PathNode = {children: new Map(), enumerated: false};
        const wrap = (value: object, node: PathNode): unknown => {
        // Frozen targets (collection snapshot) cannot hand out nested proxies, so track over a shallow copy.
        const target = Object.isFrozen(value) ? (Array.isArray(value) ? [...value] : {...value}) : value;
        const child = (prop: PropertyKey): PathNode => {
            let next = node.children.get(prop);
            if (!next) {
                next = {children: new Map(), enumerated: false};
                node.children.set(prop, next);
            }
            return next;
        };
        return new Proxy(target, {
            get(t, prop, receiver) {
                const v = Reflect.get(t, prop, receiver);
                if (typeof prop === 'symbol' || typeof v === 'function') {
                    return v;
                }
                const n = child(prop);
                if (v !== null && typeof v === 'object') {
                    return wrap(v as object, n);
                }
                return v;
            },
            has(t, prop) {
                child(prop);
                return Reflect.has(t, prop);
            },
            ownKeys(t) {
                node.enumerated = true;
                return Reflect.ownKeys(t);
            },
            getOwnPropertyDescriptor(t, prop) {
                child(prop);
                return Reflect.getOwnPropertyDescriptor(t, prop);
            },
        });
    };
    try {
        run(wrap(data as object, root) as T);
    } catch {
        return 'unknown';
    }
    const leafPaths: PropertyKey[][] = [];
    const refPaths: PropertyKey[][] = [];
    const walk = (node: PathNode, path: PropertyKey[]) => {
        if (node.enumerated) {
            refPaths.push(path);
        }
        if (node.children.size === 0) {
            if (!node.enumerated) {
                leafPaths.push(path);
            }
            return;
        }
        for (const [prop, child] of node.children) {
            walk(child, [...path, prop]);
        }
    };
    walk(root, []);
    return {leafPaths, refPaths};
}

function readPath(value: unknown, path: PropertyKey[], depth: number): unknown {
    let v = value;
    for (let i = 0; i < depth; i++) {
        if (v === null || typeof v !== 'object') {
            return undefined;
        }
        v = (v as Record<PropertyKey, unknown>)[path[i]];
    }
    return v;
}

/** Trie-walk equivalent: prune on `===` at any prefix, else compare the leaf. */
function pathUnchanged(prev: unknown, next: unknown, path: PropertyKey[], deepLeaf: boolean, isEqual: (a: unknown, b: unknown) => boolean): boolean {
    for (let depth = 0; depth <= path.length; depth++) {
        const a = readPath(prev, path, depth);
        const b = readPath(next, path, depth);
        if (a === b) {
            return true;
        }
        if (depth === path.length || a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
            if (depth < path.length) {
                return false;
            }
            return deepLeaf ? isEqual(a, b) : Object.is(a, b);
        }
    }
    return false;
}

function sameKeys(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true;
    }
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return false;
    }
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) {
        return false;
    }
    for (const k of ka) {
        if (!Object.prototype.hasOwnProperty.call(b, k)) {
            return false;
        }
    }
    return true;
}

function pathsUnchangedShallow(paths: PathAccess | undefined, prev: unknown, next: unknown): boolean {
    if (!paths || paths === 'unknown') {
        return false;
    }
    for (const p of paths.leafPaths) {
        if (!pathUnchanged(prev, next, p, false, Object.is)) {
            return false;
        }
    }
    for (const p of paths.refPaths) {
        if (!sameKeys(readPath(prev, p, p.length), readPath(next, p, p.length))) {
            return false;
        }
    }
    return true;
}

function pathsUnchanged(paths: PathAccess | undefined, prev: unknown, next: unknown, deepLeaf: boolean, isEqual: (a: unknown, b: unknown) => boolean): boolean {
    if (!paths || paths === 'unknown') {
        return false;
    }
    for (const p of paths.leafPaths) {
        if (!pathUnchanged(prev, next, p, deepLeaf, isEqual)) {
            return false;
        }
    }
    for (const p of paths.refPaths) {
        const a = readPath(prev, p, p.length);
        const b = readPath(next, p, p.length);
        if (a !== b && !(deepLeaf && isEqual(a, b))) {
            return false;
        }
    }
    return true;
}

/** Path-skip prototype (expensify-issues#3042): 'off' | 'static' (paths recorded once, like declared `paths`) | 'auto' (re-recorded every run). */
type ProtoMode = 'off' | 'static' | 'auto';
function getProtoMode(): ProtoMode {
    const m = (globalThis as {__ONYX_PATH_PROTO__?: string}).__ONYX_PATH_PROTO__ ?? (typeof process !== 'undefined' ? process.env?.ONYX_PATH_PROTO : undefined);
    return m === 'static' || m === 'auto' ? m : 'off';
}
let protoChecked = 0;
let protoSkipped = 0;
let protoCheckMs = 0;
let protoRecordMs = 0;
function countProtoCheck(skipped: boolean, ms: number): void {
    protoChecked++;
    if (skipped) {
        protoSkipped++;
    }
    protoCheckMs += ms;
}
function countProtoRecord(ms: number): void {
    protoRecordMs += ms;
}
/** Strict path check used by the prototype: prune on `===`, compare leaves by reference. */
function protoPathsUnchanged(paths: PathAccess | undefined, prev: unknown, next: unknown): boolean {
    return pathsUnchanged(paths, prev, next, false, Object.is);
}

let deepEqualImpl: (a: unknown, b: unknown) => boolean = Object.is;

function setDeepEqual(fn: (a: unknown, b: unknown) => boolean): void {
    deepEqualImpl = fn;
}

function createInstanceState(): InstanceState {
    return {lastData: undefined, lastAccess: undefined, lastPaths: undefined, hasRun: false};
}

function measureSelect<TData, TResult>(key: OnyxKey, selector: (data: TData) => TResult, state: InstanceState, data: TData): TResult {
    const entry = getEntry(key, selector as (...args: never[]) => unknown);
    const start = now();
    const result = selector(data);
    const elapsed = now() - start;
    entry.selectorMs += elapsed;
    entry.maxSelectorMs = Math.max(entry.maxSelectorMs, elapsed);
    if (dispatchDepth > 0) {
        selectorInDispatchMs += elapsed;
        selectorInDispatchRuns++;
    }
    const overheadStart = now();
    try {
        return measureSelectTail(entry, selector, state, data, result, elapsed);
    } finally {
        if (dispatchDepth > 0) {
            overheadInDispatchMs += now() - overheadStart;
        }
    }
}

function measureSelectTail<TData, TResult>(entry: Entry, selector: (data: TData) => TResult, state: InstanceState, data: TData, result: TResult, elapsed: number): TResult {
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
        if (pathsUnchanged(state.lastPaths, state.lastData, data, false, deepEqualImpl)) {
            entry.pathSkippable++;
            entry.pathSkippableMs += elapsed;
        }
        if (pathsUnchanged(state.lastPaths, state.lastData, data, true, deepEqualImpl)) {
            entry.pathSkippableDeep++;
        }
        if (pathsUnchangedShallow(state.lastPaths, state.lastData, data)) {
            entry.shallowSkippable++;
            entry.shallowSkippableMs += elapsed;
        }
    }

    state.lastAccess = recordAccess(data, selector);
    const trackStart = now();
    state.lastPaths = recordPaths(data, selector);
    entry.trackMs += now() - trackStart;
    entry.trackRuns++;
    if (state.lastPaths !== 'unknown') {
        entry.lastPathCount = state.lastPaths.leafPaths.length + state.lastPaths.refPaths.length;
        entry.maxPathCount = Math.max(entry.maxPathCount, entry.lastPathCount);
    }
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
            pathSkippableMs: round(e.pathSkippableMs),
            shallowSkippableMs: round(e.shallowSkippableMs),
            trackMs: round(e.trackMs),
            maxSelectorMs: round(e.maxSelectorMs),
            deepEqualMs: round(e.deepEqualMs),
            maxDeepEqualMs: round(e.maxDeepEqualMs),
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
        pathSkippable: 0,
        pathSkippableDeep: 0,
        pathSkippableMs: 0,
        shallowSkippable: 0,
        shallowSkippableMs: 0,
        trackMs: 0,
        trackRuns: 0,
        selectorMs: 0,
        skippableMs: 0,
        deepEqualCalls: 0,
        deepEqualRefHits: 0,
        deepEqualMs: 0,
        changed: 0,
    };
    for (const e of entries.values()) {
        t.dataRecomputes += e.dataRecomputes;
        t.identityReruns += e.identityReruns;
        t.skippable += e.skippable;
        t.wholeInput += e.wholeInput;
        t.pathSkippable += e.pathSkippable;
        t.pathSkippableDeep += e.pathSkippableDeep;
        t.pathSkippableMs += e.pathSkippableMs;
        t.shallowSkippable += e.shallowSkippable;
        t.shallowSkippableMs += e.shallowSkippableMs;
        t.trackMs += e.trackMs;
        t.trackRuns += e.trackRuns;
        t.selectorMs += e.selectorMs;
        t.skippableMs += e.skippableMs;
        t.deepEqualCalls += e.deepEqualCalls;
        t.deepEqualRefHits += e.deepEqualRefHits;
        t.deepEqualMs += e.deepEqualMs;
        t.changed += e.changed;
    }
    return {...t, selectorMs: round(t.selectorMs), skippableMs: round(t.skippableMs), pathSkippableMs: round(t.pathSkippableMs), shallowSkippableMs: round(t.shallowSkippableMs), trackMs: round(t.trackMs), deepEqualMs: round(t.deepEqualMs)};
}

type ListenerKind = 'useOnyx' | 'connect' | 'other';
const listenerKinds = new WeakMap<object, ListenerKind>();
const listenerLabels = new WeakMap<object, string>();
function tagListener<T extends object>(fn: T, kind: ListenerKind, label?: string): T {
    listenerKinds.set(fn, kind);
    if (label) {
        listenerLabels.set(fn, label);
    }
    return fn;
}

let dispatchDepth = 0;
let overheadInDispatchMs = 0;
let selectorInDispatchMs = 0;
let selectorInDispatchRuns = 0;
type KindEntry = {id: string; calls: number; ms: number; maxMs: number};
const kinds = new Map<string, KindEntry>();

function enterDispatch(): void {
    dispatchDepth++;
}
function exitDispatch(): void {
    dispatchDepth--;
}

function measureListener(key: OnyxKey, fn: object, ms: number): void {
    const keyBase = OnyxKeys.getCollectionKey(key) ?? key;
    const label = listenerLabels.get(fn);
    const id = `${listenerKinds.get(fn) ?? 'other'}@${keyBase}${label ? ` ${label}` : ''}`;
    let k = kinds.get(id);
    if (!k) {
        k = {id, calls: 0, ms: 0, maxMs: 0};
        kinds.set(id, k);
    }
    k.calls++;
    k.ms += ms;
    k.maxMs = Math.max(k.maxMs, ms);
}

function dumpKinds(): KindEntry[] {
    return [...kinds.values()].map((k) => ({...k, ms: round(k.ms), maxMs: round(k.maxMs)})).sort((a, b) => b.ms - a.ms);
}

function dispatchSummary() {
    const byKind: Record<string, {calls: number; ms: number}> = {};
    for (const k of kinds.values()) {
        const kind = k.id.split('@')[0];
        byKind[kind] = byKind[kind] ?? {calls: 0, ms: 0};
        byKind[kind].calls += k.calls;
        byKind[kind].ms = round(byKind[kind].ms + k.ms);
    }
    return {byKind, overheadInDispatchMs: round(overheadInDispatchMs), selectorInDispatchMs: round(selectorInDispatchMs), selectorInDispatchRuns, proto: {mode: getProtoMode(), checked: protoChecked, skipped: protoSkipped, checkMs: round(protoCheckMs), recordMs: round(protoRecordMs)}};
}

type DispatchEntry = {key: string; kind: 'key' | 'collection'; dispatches: number; listeners: number; ms: number; maxMs: number};
const dispatches = new Map<string, DispatchEntry>();

function measureDispatch(key: OnyxKey, kind: 'key' | 'collection', listeners: number, ms: number): void {
    const keyBase = OnyxKeys.getCollectionKey(key) ?? key;
    const id = `${kind}:${keyBase}`;
    let d = dispatches.get(id);
    if (!d) {
        d = {key: keyBase, kind, dispatches: 0, listeners: 0, ms: 0, maxMs: 0};
        dispatches.set(id, d);
    }
    d.dispatches++;
    d.listeners += listeners;
    d.ms += ms;
    d.maxMs = Math.max(d.maxMs, ms);
}

function dumpDispatch(): DispatchEntry[] {
    return [...dispatches.values()].map((d) => ({...d, ms: round(d.ms), maxMs: round(d.maxMs)})).sort((a, b) => b.ms - a.ms);
}

function reset(): void {
    entries.clear();
    dispatches.clear();
    kinds.clear();
    overheadInDispatchMs = 0;
    selectorInDispatchMs = 0;
    selectorInDispatchRuns = 0;
    protoChecked = 0;
    protoSkipped = 0;
    protoCheckMs = 0;
    protoRecordMs = 0;
}

(globalThis as {__onyxSelectorStats?: unknown}).__onyxSelectorStats = {dump, totals, reset, dumpDispatch, dumpKinds, dispatchSummary};

export {getProtoMode, countProtoCheck, countProtoRecord, protoPathsUnchanged, recordPaths, isEnabled, isTimingEnabled, createInstanceState, measureSelect, measureEqual, measureDispatch, setDeepEqual, now, tagListener, measureListener, enterDispatch, exitDispatch};
export type {InstanceState, PathAccess};

import {act, renderHook} from '@testing-library/react-native';

import type {OnyxCollection} from '../../lib';

import Onyx, {useOnyx} from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

type Stats = {
    dump: () => Array<{selector: string; dataRecomputes: number; skippable: number; wholeInput: number; changed: number}>;
    reset: () => void;
};

const COLLECTION = 'stats_';
const stats = () => (globalThis as unknown as {__onyxSelectorStats: Stats}).__onyxSelectorStats;

Onyx.init({keys: {COLLECTION: {STATS: COLLECTION}}});

beforeAll(() => {
    (globalThis as {__ONYX_SELECTOR_STATS__?: boolean}).__ONYX_SELECTOR_STATS__ = true;
});

beforeEach(async () => {
    await Onyx.clear();
    await Onyx.multiSet({[`${COLLECTION}1`]: {id: 1, v: 0}, [`${COLLECTION}2`]: {id: 2, v: 0}, [`${COLLECTION}3`]: {id: 3, v: 0}});
    stats().reset();
});

function pickOne(c: OnyxCollection<{id: number; v: number}>) {
    return c?.[`${COLLECTION}1`]?.v;
}

function allValues(c: OnyxCollection<{id: number; v: number}>) {
    return Object.values(c ?? {}).map((m) => m?.v);
}

describe('selectorStats', () => {
    it('counts a recompute as skippable when only unread members changed', async () => {
        // Given a selector that reads one member of the collection
        renderHook(() => useOnyx(COLLECTION, {selector: pickOne}));
        await act(waitForPromisesToResolve);

        // When an unrelated member and then the read member change
        await act(() => Onyx.merge(`${COLLECTION}2`, {v: 1}));
        await act(() => Onyx.merge(`${COLLECTION}1`, {v: 1}));

        // Then the first recompute is skippable by a member-level memo and the second is not
        const entry = stats()
            .dump()
            .find((e) => e.selector === 'pickOne');
        expect(entry?.dataRecomputes).toBe(2);
        expect(entry?.skippable).toBe(1);
        expect(entry?.changed).toBe(1);
    });

    it('marks selectors that enumerate the collection as whole-input', async () => {
        // Given a selector that walks every member
        renderHook(() => useOnyx(COLLECTION, {selector: allValues}));
        await act(waitForPromisesToResolve);

        // When any member changes
        await act(() => Onyx.merge(`${COLLECTION}2`, {v: 1}));

        // Then the recompute is counted as whole-input, never skippable
        const entry = stats()
            .dump()
            .find((e) => e.selector === 'allValues');
        expect(entry?.dataRecomputes).toBe(1);
        expect(entry?.wholeInput).toBe(1);
        expect(entry?.skippable).toBe(0);
    });

    it('counts a nested sibling write as path-skippable but an ancestor read as not', async () => {
        // Given A reads summary (object leaf), B reads summary.currency, C reads summary.amount on one member
        await Onyx.set(`${COLLECTION}9`, {summary: {currency: 'USD', amount: 1}, name: 'x'} as never);
        const selA = function selA(r: unknown) {
            return (r as {summary?: unknown})?.summary;
        };
        const selB = function selB(r: unknown) {
            return (r as {summary?: {currency?: string}})?.summary?.currency;
        };
        const selC = function selC(r: unknown) {
            return (r as {summary?: {amount?: number}})?.summary?.amount;
        };
        renderHook(() => useOnyx(`${COLLECTION}9`, {selector: selA as never}));
        renderHook(() => useOnyx(`${COLLECTION}9`, {selector: selB as never}));
        renderHook(() => useOnyx(`${COLLECTION}9`, {selector: selC as never}));
        await act(waitForPromisesToResolve);
        stats().reset();

        // When only summary.amount changes, then only name changes
        await act(() => Onyx.merge(`${COLLECTION}9`, {summary: {amount: 2}} as never));
        await act(() => Onyx.merge(`${COLLECTION}9`, {name: 'y'} as never));

        // Then B skips the amount write, A and C do not; all three skip the name write
        const get = (name: string) => (stats().dump() as unknown as Array<{selector: string; dataRecomputes: number; pathSkippable: number}>).find((e) => e.selector === name);
        expect(get('selA')).toMatchObject({dataRecomputes: 2, pathSkippable: 1});
        expect(get('selB')).toMatchObject({dataRecomputes: 2, pathSkippable: 2});
        expect(get('selC')).toMatchObject({dataRecomputes: 2, pathSkippable: 1});
    });

    it('treats Onyx.set with equal content as skippable only with deep leaves', async () => {
        // Given a selector returning a nested object
        await Onyx.set(`${COLLECTION}8`, {summary: {amount: 1}} as never);
        const selObj = function selObj(r: unknown) {
            return (r as {summary?: unknown})?.summary;
        };
        renderHook(() => useOnyx(`${COLLECTION}8`, {selector: selObj as never}));
        await act(waitForPromisesToResolve);
        stats().reset();

        // When the same content is set again (fresh references, equal values)
        await act(() => Onyx.set(`${COLLECTION}8`, {summary: {amount: 1}, other: 1} as never));

        // Then the ref-leaf filter fires but the deep-leaf filter skips
        const e = (stats().dump() as unknown as Array<{selector: string; pathSkippable: number; pathSkippableDeep: number}>).find((x) => x.selector === 'selObj');
        expect(e).toMatchObject({pathSkippable: 0, pathSkippableDeep: 1});
    });

    it('tracks paths through the frozen collection snapshot', async () => {
        // Given a root selector reading one field of one member
        const selField = function selField(c: unknown) {
            return (c as Record<string, {v?: number}>)?.[`${COLLECTION}1`]?.v;
        };
        renderHook(() => useOnyx(COLLECTION, {selector: selField as never}));
        await act(waitForPromisesToResolve);
        stats().reset();

        // When another member changes
        await act(() => Onyx.merge(`${COLLECTION}2`, {v: 5}));

        // Then the run is path-skippable
        const e = (stats().dump() as unknown as Array<{selector: string; pathSkippable: number}>).find((x) => x.selector === 'selField');
        expect(e?.pathSkippable).toBe(1);
        const d = (stats() as unknown as {dumpDispatch: () => Array<{key: string; listeners: number}>}).dumpDispatch();
        expect(d.length).toBeGreaterThan(0);
    });

    it('counts an iterating selector as shallow-skippable when no read field changed', async () => {
        // Given a root selector that iterates members but reads only `id`
        const selIds = function selIds(c: unknown) {
            return Object.values((c ?? {}) as Record<string, {id?: number}>).map((m) => m?.id);
        };
        renderHook(() => useOnyx(COLLECTION, {selector: selIds as never}));
        await act(waitForPromisesToResolve);
        stats().reset();

        // When an unread field changes, then a new member is added
        await act(() => Onyx.merge(`${COLLECTION}2`, {v: 9}));
        await act(() => Onyx.merge(`${COLLECTION}4`, {id: 4, v: 0}));

        // Then only the first write is shallow-skippable; the strict path filter skips neither
        const e = (stats().dump() as unknown as Array<{selector: string; pathSkippable: number; shallowSkippable: number}>).find((x) => x.selector === 'selIds');
        expect(e).toMatchObject({pathSkippable: 0, shallowSkippable: 1});
    });
});

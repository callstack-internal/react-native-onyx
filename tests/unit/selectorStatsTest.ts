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
});

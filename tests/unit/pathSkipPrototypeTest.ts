import {act, renderHook} from '@testing-library/react-native';

import Onyx, {useOnyx} from '../../lib';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const COLLECTION = 'proto_';

Onyx.init({keys: {COLLECTION: {PROTO: COLLECTION}}});

describe('path-skip prototype', () => {
    beforeEach(async () => {
        (globalThis as {__ONYX_PATH_PROTO__?: string}).__ONYX_PATH_PROTO__ = 'static';
        await Onyx.clear();
        await Onyx.set(`${COLLECTION}1`, {summary: {currency: 'USD', amount: 1}, name: 'x'} as never);
    });

    afterAll(() => {
        (globalThis as {__ONYX_PATH_PROTO__?: string}).__ONYX_PATH_PROTO__ = 'off';
    });

    it('does not re-run a selector when only an unread sibling field changes', async () => {
        // Given a hook whose selector reads only summary.currency
        const selector = jest.fn((r: unknown) => (r as {summary?: {currency?: string}})?.summary?.currency);
        const {result} = renderHook(() => useOnyx(`${COLLECTION}1`, {selector: selector as never}));
        await act(waitForPromisesToResolve);
        selector.mockClear();

        // When only summary.amount changes
        await act(() => Onyx.merge(`${COLLECTION}1`, {summary: {amount: 2}} as never));

        // Then the listener is skipped, so the selector does not run and the value stays the same
        expect(selector).not.toHaveBeenCalled();
        expect(result.current[0]).toBe('USD');
    });

    it('still updates when a field the selector reads changes', async () => {
        // Given a hook whose selector reads only summary.currency
        const selector = (r: unknown) => (r as {summary?: {currency?: string}})?.summary?.currency;
        const {result} = renderHook(() => useOnyx(`${COLLECTION}1`, {selector: selector as never}));
        await act(waitForPromisesToResolve);

        // When summary.currency changes
        await act(() => Onyx.merge(`${COLLECTION}1`, {summary: {currency: 'EUR'}} as never));

        // Then the new value reaches the hook
        expect(result.current[0]).toBe('EUR');
    });

    it('skips a collection selector when an unread member changes', async () => {
        // Given a collection selector that reads one field of member 1
        await Onyx.set(`${COLLECTION}2`, {name: 'y'} as never);
        const selector = jest.fn((c: unknown) => (c as Record<string, {name?: string}>)?.[`${COLLECTION}1`]?.name);
        const {result} = renderHook(() => useOnyx(COLLECTION, {selector: selector as never}));
        await act(waitForPromisesToResolve);
        selector.mockClear();

        // When a different member changes, then the read member changes
        await act(() => Onyx.merge(`${COLLECTION}2`, {name: 'z'} as never));
        const callsAfterUnrelated = selector.mock.calls.length;
        await act(() => Onyx.merge(`${COLLECTION}1`, {name: 'w'} as never));

        // Then only the second write reaches the selector
        expect(callsAfterUnrelated).toBe(0);
        expect(result.current[0]).toBe('w');
    });
});

/**
 * useOnyx Tests
 *
 * Tests the useOnyx hook implementation for the prototype
 * Covers both collection and non-collection keys
 */

import {act, renderHook} from '@testing-library/react-native';
import Onyx from './Onyx';
import useOnyx from './useOnyx';
import waitForPromisesToResolve from '../../tests/utils/waitForPromisesToResolve';

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    SESSION: 'session',
    COLLECTION: {
        REPORTS: 'reports_',
        USERS: 'users_',
    },
};

beforeEach(async () => {
    // Clear cache before each test
    Onyx.clear();

    // Initialize Onyx
    await Onyx.init({
        maxCachedKeysCount: 1000,
    });
});

describe('useOnyx - Non-Collection Keys', () => {
    it('should return null and loaded status for non-existent key', async () => {
        const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

        // Wait for initial load
        await act(async () => waitForPromisesToResolve());

        expect(result.current[0]).toBeNull();
    });

    it('should return value when key is set before hook is rendered', async () => {
        await Onyx.set(ONYXKEYS.TEST_KEY, 'test-value');

        const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

        expect(result.current[0]).toEqual('test-value');
        expect(result.current[1].status).toEqual('loaded');
    });

    it('should update value when key is set after hook is rendered', async () => {
        const {result} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

        await act(async () => waitForPromisesToResolve());

        expect(result.current[0]).toBeNull();

        await act(async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'new-value');
        });

        expect(result.current[0]).toEqual('new-value');
    });

    it('should update value when key is merged', async () => {
        await Onyx.set(ONYXKEYS.SESSION, {userId: '123', email: 'test@example.com'});

        const {result} = renderHook(() => useOnyx(ONYXKEYS.SESSION));

        expect(result.current[0]).toEqual({userId: '123', email: 'test@example.com'});

        await act(async () => {
            await Onyx.merge(ONYXKEYS.SESSION, {email: 'updated@example.com'});
        });

        expect(result.current[0]).toEqual({userId: '123', email: 'updated@example.com'});
    });

    it('should work with selector option', async () => {
        await Onyx.set(ONYXKEYS.SESSION, {userId: '123', email: 'test@example.com'});

        const {result} = renderHook(() =>
            useOnyx(ONYXKEYS.SESSION, {
                selector: (session) => session?.email,
            }),
        );

        expect(result.current[0]).toEqual('test@example.com');

        await act(async () => {
            await Onyx.merge(ONYXKEYS.SESSION, {email: 'new@example.com'});
        });

        expect(result.current[0]).toEqual('new@example.com');
    });

    it('should handle multiple hooks subscribing to same key', async () => {
        await Onyx.set(ONYXKEYS.TEST_KEY, 'initial');

        const {result: result1} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));
        const {result: result2} = renderHook(() => useOnyx(ONYXKEYS.TEST_KEY));

        expect(result1.current[0]).toEqual('initial');
        expect(result2.current[0]).toEqual('initial');

        await act(async () => {
            await Onyx.set(ONYXKEYS.TEST_KEY, 'updated');
        });

        expect(result1.current[0]).toEqual('updated');
        expect(result2.current[0]).toEqual('updated');
    });
});

describe('useOnyx - Collection Keys', () => {
    it('should return null for non-existent collection', async () => {
        const {result} = renderHook(() => useOnyx(ONYXKEYS.COLLECTION.REPORTS));

        await act(async () => waitForPromisesToResolve());

        expect(result.current[0]).toEqual({});
        expect(result.current[1].status).toEqual('loaded');
    });

    it('should return collection object when members exist', async () => {
        await Onyx.set('reports_1', {id: '1', title: 'Report 1'});
        await Onyx.set('reports_2', {id: '2', title: 'Report 2'});

        const {result} = renderHook(() => useOnyx(ONYXKEYS.COLLECTION.REPORTS));

        expect(result.current[0]).toEqual({
            reports_1: {id: '1', title: 'Report 1'},
            reports_2: {id: '2', title: 'Report 2'},
        });
    });

    it('should update when collection member is added', async () => {
        await Onyx.set('reports_1', {id: '1', title: 'Report 1'});

        const {result} = renderHook(() => useOnyx(ONYXKEYS.COLLECTION.REPORTS));

        expect(result.current[0]).toEqual({
            reports_1: {id: '1', title: 'Report 1'},
        });

        await act(async () => {
            await Onyx.set('reports_2', {id: '2', title: 'Report 2'});
        });

        expect(result.current[0]).toEqual({
            reports_1: {id: '1', title: 'Report 1'},
            reports_2: {id: '2', title: 'Report 2'},
        });
    });

    it('should update when collection member is modified', async () => {
        await Onyx.set('reports_1', {id: '1', title: 'Report 1'});
        await Onyx.set('reports_2', {id: '2', title: 'Report 2'});

        const {result} = renderHook(() => useOnyx(ONYXKEYS.COLLECTION.REPORTS));

        expect(result.current[0]).toEqual({
            reports_1: {id: '1', title: 'Report 1'},
            reports_2: {id: '2', title: 'Report 2'},
        });

        await act(async () => {
            await Onyx.merge('reports_1', {title: 'Updated Report 1'});
        });

        expect(result.current[0]).toEqual({
            reports_1: {id: '1', title: 'Updated Report 1'},
            reports_2: {id: '2', title: 'Report 2'},
        });
    });

    it('should update when collection member is removed', async () => {
        await Onyx.set('reports_1', {id: '1', title: 'Report 1'});
        await Onyx.set('reports_2', {id: '2', title: 'Report 2'});

        const {result} = renderHook(() => useOnyx(ONYXKEYS.COLLECTION.REPORTS));

        expect(result.current[0]).toEqual({
            reports_1: {id: '1', title: 'Report 1'},
            reports_2: {id: '2', title: 'Report 2'},
        });

        await act(async () => {
            await Onyx.set('reports_1', null);
        });

        expect(result.current[0]).toEqual({
            reports_2: {id: '2', title: 'Report 2'},
        });
    });

    it('should work with selector for collections', async () => {
        await Onyx.set('reports_1', {id: '1', title: 'Report 1', count: 5});
        await Onyx.set('reports_2', {id: '2', title: 'Report 2', count: 10});

        const {result} = renderHook(() =>
            useOnyx(ONYXKEYS.COLLECTION.REPORTS, {
                selector: (reports) => {
                    if (!reports) return null;
                    return Object.values(reports).reduce((sum: number, report: any) => sum + (report?.count || 0), 0);
                },
            }),
        );

        expect(result.current[0]).toEqual(15);

        await act(async () => {
            await Onyx.set('reports_3', {id: '3', title: 'Report 3', count: 3});
        });

        expect(result.current[0]).toEqual(18);
    });

    it('should handle multiple hooks subscribing to same collection', async () => {
        await Onyx.set('reports_1', {id: '1', title: 'Report 1'});

        const {result: result1} = renderHook(() => useOnyx(ONYXKEYS.COLLECTION.REPORTS));
        const {result: result2} = renderHook(() => useOnyx(ONYXKEYS.COLLECTION.REPORTS));

        expect(result1.current[0]).toEqual({
            reports_1: {id: '1', title: 'Report 1'},
        });
        expect(result2.current[0]).toEqual({
            reports_1: {id: '1', title: 'Report 1'},
        });

        await act(async () => {
            await Onyx.set('reports_2', {id: '2', title: 'Report 2'});
        });

        expect(result1.current[0]).toEqual({
            reports_1: {id: '1', title: 'Report 1'},
            reports_2: {id: '2', title: 'Report 2'},
        });
        expect(result2.current[0]).toEqual({
            reports_1: {id: '1', title: 'Report 1'},
            reports_2: {id: '2', title: 'Report 2'},
        });
    });
});

describe('useOnyx - Collection Member Keys', () => {
    it('should return null for non-existent collection member', async () => {
        const {result} = renderHook(() => useOnyx('reports_1'));

        await act(async () => waitForPromisesToResolve());

        expect(result.current[0]).toBeNull();
    });

    it('should return value for existing collection member', async () => {
        await Onyx.set('reports_1', {id: '1', title: 'Report 1'});

        const {result} = renderHook(() => useOnyx('reports_1'));

        expect(result.current[0]).toEqual({id: '1', title: 'Report 1'});
    });

    it('should update when collection member is modified', async () => {
        await Onyx.set('reports_1', {id: '1', title: 'Report 1'});

        const {result} = renderHook(() => useOnyx('reports_1'));

        expect(result.current[0]).toEqual({id: '1', title: 'Report 1'});

        await act(async () => {
            await Onyx.merge('reports_1', {title: 'Updated Report 1'});
        });

        expect(result.current[0]).toEqual({id: '1', title: 'Updated Report 1'});
    });

    it('should update when collection member is set to null', async () => {
        await Onyx.set('reports_1', {id: '1', title: 'Report 1'});

        const {result} = renderHook(() => useOnyx('reports_1'));

        expect(result.current[0]).toEqual({id: '1', title: 'Report 1'});

        await act(async () => {
            await Onyx.set('reports_1', null);
        });

        expect(result.current[0]).toBeNull();
    });
});

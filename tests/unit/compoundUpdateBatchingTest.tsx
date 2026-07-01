/**
 * Real-condition probe for the OnyxDerived recompute-amplification discussion.
 *
 * Two things we want to see with actual `useOnyx` / `Onyx.connect` behavior:
 *
 *  1. A normal component that reads several keys via `useOnyx` re-renders ONCE for a single
 *     `Onyx.update` that touches all of them — i.e. React 18 already batches multi-key updates,
 *     so the "multi-render" problem does not hit ordinary subscribers.
 *
 *  2. An OnyxDerived-style value (one connection per dependency, recompute on each change) recomputes
 *     ONCE PER CHANGED DEPENDENCY for that same single `Onyx.update` — this is the real cost, and it
 *     happens because the recompute runs in connection callbacks, outside React's render cycle, so
 *     React's batching can't help it. A tiny coalescer in the derived layer collapses it back to one.
 *
 *  3. Three coalescing shapes all collapse N→1: the PR's approach (setTimeout(0) + `sourceValues`
 *     accumulation), Rory's option A (setTimeout(0) + a pending-flush flag, no `sourceValues`), and
 *     option A + `getCollectionDelta` (reconstruct the changed members at flush time). The difference
 *     the tests surface is NOT the recompute count (all = 1) but what change hint `compute` receives:
 *     full `sourceValues` (proposal), none (option A), or a precise delta (option A + delta). All keep
 *     `dependencyValues` fully populated at flush, which is why one coalesced compute is correct.
 *
 * Fidelity to the real engine (App: src/libs/actions/OnyxDerived/index.ts): the real one opens one
 * `connectWithoutView` per dependency and, in each callback, `setDependencyValue(i, value)` then calls
 * `compute()` synchronously with NO coalescing, writing via `setDerivedValue`
 * (= `Onyx.set(key, value, {skipCacheCheck: true})`). We reproduce that shape, count `compute()`
 * invocations, and (for the coalescing variants) assert what change hint `compute` receives. We
 * intentionally do NOT model: the `NVP_PREFERRED_LOCALE` locale special-case, the `areAllConnectionsSet`
 * init gate (steady-state only here — we reset the counter after mount), or the fast-path logic inside a
 * real `compute`.
 *
 * RESULTS:
 *
 * ┌──────────────────────────────────────────┬────────────────────────────────────┬──────────────────────────────────────────────────────────────┐
 * │ Scenario                                 │ Result                             │ Meaning                                                      │
 * ├──────────────────────────────────────────┼────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 * │ Normal component reading all 4 keys via  │ 1 render                           │ React 18 already batches multi-key updates — the multi-      │
 * │ useOnyx                                  │                                    │ render problem does NOT hit ordinary subscribers.            │
 * ├──────────────────────────────────────────┼────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 * │ In-component derivation (useOnyx x 4 +   │ 1 compute                          │ Counterfactual to OnyxDerived: derive inside render and      │
 * │ useMemo)                                 │                                    │ React batches it to one compute.                             │
 * ├──────────────────────────────────────────┼────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 * │ OnyxDerived-style value, no coalescing   │ 4 recomputes, consumer renders     │ The real cost is the computes (thread-blocking), not renders │
 * │ (current prod)                           │ once                               │ — they run in connection callbacks outside React's render    │
 * │                                          │                                    │ cycle, where batching can't reach them. Contrast the 1 above.│
 * ├──────────────────────────────────────────┼────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 * │ + Proposal (setTimeout(0) + sourceValues │ 1 recompute, compute still gets    │ Collapses N->1 AND preserves fast-path hints. Cost: the      │
 * │ accumulation)                            │ sourceValues for all 4 deps        │ accumulation bookkeeping.                                    │
 * ├──────────────────────────────────────────┼────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 * │ + Option A (setTimeout(0) + pending-     │ 1 recompute, sourceValues =        │ Collapses N->1 but LOSES the fast-path hint (simpler,        │
 * │ flush flag)                              │ undefined, dependencyValues        │ though).                                                     │
 * │                                          │ complete                           │                                                              │
 * ├──────────────────────────────────────────┼────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
 * │ + Option A with getCollectionDelta       │ 1 recompute, precise changed       │ Collapses N->1 AND recovers the fast-path hint by diffing    │
 * │                                          │ member recovered (report_1,        │ current-vs-last-flush at flush time — A's simplicity + the   │
 * │                                          │ excludes untouched report_2), no   │ proposal's info.                                             │
 * │                                          │ accumulation                       │                                                              │
 * └──────────────────────────────────────────┴────────────────────────────────────┴──────────────────────────────────────────────────────────────┘
 *
 * **All three coalescing variants collapse N→1.** So the design question is *not* whether to coalesce or where (derived layer — settled), it's purely **how to feed `compute` the change hint**: accumulate `sourceValues` (proposal), drop it (option A), or reconstruct it via `getCollectionDelta` (option A + delta). All keep `dependencyValues` fully populated at flush, which is why one coalesced compute is correct.
 */
import {useMemo} from 'react';
import {act, renderHook} from '@testing-library/react-native';
import Onyx, {useOnyx} from '../../lib';
import type {Connection} from '../../lib/OnyxConnectionManager';
import type {OnyxUpdate} from '../../lib/types';
import waitForPromisesToResolve from '../utils/waitForPromisesToResolve';

const ONYXKEYS = {
    DERIVED_ATTRIBUTES: 'derivedAttributes',
    SESSION: 'session',
    PREFERRED_LOCALE: 'preferredLocale',
    COLLECTION: {
        REPORT: 'report_',
        TRANSACTION: 'transaction_',
    },
};

Onyx.init({keys: ONYXKEYS});

// The dependencies of our fake derived value (mix of collections + scalar keys, like reportAttributes).
const DEPS = [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.COLLECTION.TRANSACTION, ONYXKEYS.SESSION, ONYXKEYS.PREFERRED_LOCALE];

const isCollectionKey = (key: string) => key.endsWith('_');

/**
 * Copy of the App's `src/libs/getCollectionDelta.ts` (PR #93438): the subset of collection members that
 * changed between two snapshots, via reference-equality scan (relies on Onyx structural sharing).
 * Returns `undefined` when nothing changed.
 */
function getCollectionDelta(current: Record<string, unknown> | undefined, previous: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (current === previous) {
        return undefined;
    }
    const delta: Record<string, unknown> = {};
    let hasChanges = false;
    if (current) {
        for (const key of Object.keys(current)) {
            if (current[key] === previous?.[key]) {
                continue;
            }
            delta[key] = current[key];
            hasChanges = true;
        }
    }
    if (previous) {
        for (const key of Object.keys(previous)) {
            if (current && key in current) {
                continue;
            }
            delta[key] = undefined;
            hasChanges = true;
        }
    }
    return hasChanges ? delta : undefined;
}

/** One logical server-response-style update that touches every dependency at once. */
function buildCompoundUpdate(
    revision: number,
): Array<OnyxUpdate<typeof ONYXKEYS.COLLECTION.REPORT | typeof ONYXKEYS.COLLECTION.TRANSACTION | typeof ONYXKEYS.SESSION | typeof ONYXKEYS.PREFERRED_LOCALE>> {
    return [
        {onyxMethod: Onyx.METHOD.MERGE_COLLECTION, key: ONYXKEYS.COLLECTION.REPORT, value: {[`${ONYXKEYS.COLLECTION.REPORT}1`]: {id: 1, rev: revision}}},
        {onyxMethod: Onyx.METHOD.MERGE_COLLECTION, key: ONYXKEYS.COLLECTION.TRANSACTION, value: {[`${ONYXKEYS.COLLECTION.TRANSACTION}1`]: {id: 1, rev: revision}}},
        {onyxMethod: Onyx.METHOD.MERGE, key: ONYXKEYS.SESSION, value: {rev: revision}},
        {onyxMethod: Onyx.METHOD.MERGE, key: ONYXKEYS.PREFERRED_LOCALE, value: {rev: revision}},
    ];
}

async function seed(): Promise<void> {
    await Onyx.multiSet({
        [`${ONYXKEYS.COLLECTION.REPORT}1`]: {id: 1, rev: 0},
        // A second, untouched report member so the delta test can prove it excludes what didn't change.
        [`${ONYXKEYS.COLLECTION.REPORT}2`]: {id: 2, rev: 0},
        [`${ONYXKEYS.COLLECTION.TRANSACTION}1`]: {id: 1, rev: 0},
        [ONYXKEYS.SESSION]: {rev: 0},
        [ONYXKEYS.PREFERRED_LOCALE]: {rev: 0},
    });
}

describe('compound Onyx.update — real useOnyx / OnyxDerived conditions', () => {
    afterEach(() => Onyx.clear());

    it('re-renders a multi-useOnyx component only ONCE for a single compound Onyx.update', async () => {
        await seed();

        let renders = 0;
        renderHook(() => {
            renders += 1;
            useOnyx(ONYXKEYS.COLLECTION.REPORT);
            useOnyx(ONYXKEYS.COLLECTION.TRANSACTION);
            useOnyx(ONYXKEYS.SESSION);
            useOnyx(ONYXKEYS.PREFERRED_LOCALE);
        });

        // Let the initial connect + loading renders settle, then count only what the update causes.
        await act(async () => waitForPromisesToResolve());
        const before = renders;

        await act(async () => {
            Onyx.update(buildCompoundUpdate(1));
            await waitForPromisesToResolve();
        });

        const rendersFromUpdate = renders - before;
        // eslint-disable-next-line no-console
        console.log(`\n[normal subscriber] renders caused by one compound Onyx.update (4 keys): ${rendersFromUpdate}\n`);
        expect(rendersFromUpdate).toBe(1);
    });

    // The counterfactual to OnyxDerived: derive the value INSIDE a component (useOnyx × N + useMemo)
    // instead of outside React. Because React batches the compound update to one render (test above),
    // the useMemo recomputes ONCE — proving "even without derived values you'd get N recomputes" is false.
    it('computes an in-component derived value (useOnyx × N + useMemo) only ONCE for a compound Onyx.update', async () => {
        await seed();

        let computeCount = 0;
        renderHook(() => {
            const [report] = useOnyx(ONYXKEYS.COLLECTION.REPORT);
            const [transaction] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION);
            const [session] = useOnyx(ONYXKEYS.SESSION);
            const [locale] = useOnyx(ONYXKEYS.PREFERRED_LOCALE);
            // In-render derivation — the "compute" React can batch, unlike OnyxDerived's out-of-render callbacks.
            useMemo(() => {
                computeCount += 1;
                return {report, transaction, session, locale};
            }, [report, transaction, session, locale]);
        });

        // Settle mount + loading recomputes, then count only what the update causes.
        await act(async () => waitForPromisesToResolve());
        computeCount = 0;

        await act(async () => {
            Onyx.update(buildCompoundUpdate(1));
            await waitForPromisesToResolve();
        });

        // eslint-disable-next-line no-console
        console.log(`\n[in-component useMemo] computes for one compound Onyx.update: ${computeCount}\n`);
        // One batched render → one useMemo recompute. Contrast with the OnyxDerived case below (4).
        expect(computeCount).toBe(1);
    });

    it('recomputes an OnyxDerived-style value ONCE PER CHANGED DEPENDENCY (the problem)', async () => {
        await seed();

        // Mimic OnyxDerived: one connection per dependency; each change recomputes and writes the derived key.
        let computeCount = 0;
        const connections: Connection[] = DEPS.map((key) =>
            Onyx.connectWithoutView({
                key,
                callback: () => {
                    computeCount += 1;
                    // Matches OnyxDerived's setDerivedValue(): skipCacheCheck since it fully controls the value's lifecycle.
                    Onyx.set(ONYXKEYS.DERIVED_ATTRIBUTES, {computedAt: computeCount}, {skipCacheCheck: true});
                },
            }),
        );

        // A consumer of the derived value.
        let consumerRenders = 0;
        renderHook(() => {
            consumerRenders += 1;
            useOnyx(ONYXKEYS.DERIVED_ATTRIBUTES);
        });

        await act(async () => waitForPromisesToResolve());
        computeCount = 0;
        const rendersBefore = consumerRenders;

        await act(async () => {
            Onyx.update(buildCompoundUpdate(1));
            await waitForPromisesToResolve();
        });

        // eslint-disable-next-line no-console
        console.log(`\n[OnyxDerived, unbatched] recomputes for one compound Onyx.update: ${computeCount}, consumer renders: ${consumerRenders - rendersBefore}\n`);
        // One recompute per changed dependency — this is the amplification the proposal targets.
        expect(computeCount).toBe(DEPS.length);

        // eslint-disable-next-line unicorn/no-array-for-each
        connections.forEach((c) => Onyx.disconnect(c));
    });

    // The PR's approach (https://github.com/Expensify/App/pull/94574): debounce onto a macrotask AND
    // accumulate each triggering dependency's partial `sourceValue` so `compute` still gets the hint.
    it("proposal's approach (setTimeout + sourceValues accumulation) collapses to ONE and preserves sourceValues", async () => {
        await seed();

        const dependencyValues: unknown[] = new Array(DEPS.length);
        let derivedValue: unknown;
        let computeCount = 0;
        let lastSourceValues: Record<string, unknown> | undefined;
        let allDepsPresentAtCompute = false;
        const compute = (deps: unknown[], context: {sourceValues?: Record<string, unknown>}) => {
            computeCount += 1;
            lastSourceValues = context.sourceValues;
            allDepsPresentAtCompute = deps.every((d) => d !== undefined);
            return {computedAt: computeCount};
        };

        const context: {currentValue: unknown; sourceValues?: Record<string, unknown>} = {currentValue: undefined, sourceValues: undefined};
        let pendingFlush: ReturnType<typeof setTimeout> | null = null;
        const pendingSourceValues: Record<string, unknown> = {};
        const recompute = (sourceKey: string, sourceValue: unknown) => {
            // Accumulate the triggering dependency's partial (shallow-merge members for collections).
            if (sourceValue !== undefined) {
                pendingSourceValues[sourceKey] = isCollectionKey(sourceKey) ? {...(pendingSourceValues[sourceKey] as object), ...(sourceValue as object)} : sourceValue;
            }
            if (pendingFlush !== null) {
                return;
            }
            pendingFlush = setTimeout(() => {
                pendingFlush = null;
                context.currentValue = derivedValue;
                context.sourceValues = {...pendingSourceValues};
                // eslint-disable-next-line unicorn/no-array-for-each
                Object.keys(pendingSourceValues).forEach((k) => delete pendingSourceValues[k]);
                derivedValue = compute(dependencyValues, context);
                Onyx.set(ONYXKEYS.DERIVED_ATTRIBUTES, derivedValue as Record<string, unknown>, {skipCacheCheck: true});
            }, 0);
        };

        const connections: Connection[] = DEPS.map((key, i) =>
            Onyx.connectWithoutView({
                key,
                callback: (value, _matchedKey, sourceValue) => {
                    dependencyValues[i] = value; // setDependencyValue: accumulate the latest full value
                    recompute(key, isCollectionKey(key) ? sourceValue : value);
                },
            }),
        );

        await act(async () => waitForPromisesToResolve());
        computeCount = 0;

        await act(async () => {
            Onyx.update(buildCompoundUpdate(1));
            // Two turns: the coalescer's setTimeout(0) flush is scheduled from inside a callback during
            // the first turn's microtask drain, so it only runs on the next macrotask turn.
            await waitForPromisesToResolve();
            await waitForPromisesToResolve();
        });

        // eslint-disable-next-line no-console
        console.log(
            `\n[proposal: setTimeout + sourceValues] recomputes: ${computeCount}, sourceValues keys: ${
                lastSourceValues ? Object.keys(lastSourceValues).join(',') : 'undefined'
            }, all deps present: ${allDepsPresentAtCompute}\n`,
        );
        expect(computeCount).toBe(1);
        // compute still receives an accumulated partial for every changed dependency — fast-paths keep working.
        expect(lastSourceValues && Object.keys(lastSourceValues).sort()).toEqual([...DEPS].sort());
        // dependencyValues is fully populated at flush — the reason a single coalesced compute is correct.
        expect(allDepsPresentAtCompute).toBe(true);

        // eslint-disable-next-line unicorn/no-array-for-each
        connections.forEach((c) => Onyx.disconnect(c));
    });

    // Rory's option A: debounce with just a pending-flush flag and NO sourceValues accumulation, relying
    // on `dependencyValues` (already set synchronously per callback) being complete by flush time.
    it("Rory's option A (setTimeout + pending flag, no sourceValues) collapses to ONE but drops sourceValues", async () => {
        await seed();

        const dependencyValues: unknown[] = new Array(DEPS.length);
        let derivedValue: unknown;
        let computeCount = 0;
        let lastSourceValues: unknown = 'UNSET';
        let allDepsPresentAtCompute = false;
        const compute = (deps: unknown[], context: {sourceValues?: unknown}) => {
            computeCount += 1;
            lastSourceValues = context.sourceValues;
            allDepsPresentAtCompute = deps.every((d) => d !== undefined);
            return {computedAt: computeCount};
        };

        const context: {currentValue: unknown; sourceValues?: unknown} = {currentValue: undefined, sourceValues: undefined};
        let pendingFlush: ReturnType<typeof setTimeout> | null = null;
        const recompute = () => {
            if (pendingFlush !== null) {
                return;
            }
            pendingFlush = setTimeout(() => {
                pendingFlush = null;
                context.currentValue = derivedValue;
                context.sourceValues = undefined; // no partial hint
                derivedValue = compute(dependencyValues, context);
                Onyx.set(ONYXKEYS.DERIVED_ATTRIBUTES, derivedValue as Record<string, unknown>, {skipCacheCheck: true});
            }, 0);
        };

        const connections: Connection[] = DEPS.map((key, i) =>
            Onyx.connectWithoutView({
                key,
                callback: (value) => {
                    dependencyValues[i] = value; // setDependencyValue already accumulates the latest values
                    recompute();
                },
            }),
        );

        await act(async () => waitForPromisesToResolve());
        computeCount = 0;

        await act(async () => {
            Onyx.update(buildCompoundUpdate(1));
            await waitForPromisesToResolve();
            await waitForPromisesToResolve();
        });

        // eslint-disable-next-line no-console
        console.log(`\n[option A: setTimeout + pending flag] recomputes: ${computeCount}, sourceValues: ${String(lastSourceValues)}, all deps present: ${allDepsPresentAtCompute}\n`);
        expect(computeCount).toBe(1);
        // The trade-off: compute loses the sourceValues hint (fast-paths break)...
        expect(lastSourceValues).toBeUndefined();
        // ...but dependencyValues is still fully populated, which is why A can compute correctly.
        expect(allDepsPresentAtCompute).toBe(true);

        // eslint-disable-next-line unicorn/no-array-for-each
        connections.forEach((c) => Onyx.disconnect(c));
    });

    // The suggested middle path: option A's simple coalescer (no sourceValues accumulation in callbacks),
    // but recover the changed-members hint at FLUSH time by diffing current-vs-last-flush snapshots with
    // getCollectionDelta (PR #93438). Gets A's simplicity AND the proposal's fast-path info.
    it('option A + getCollectionDelta collapses to ONE and recovers the precise changed members (no accumulation)', async () => {
        await seed();

        const dependencyValues: unknown[] = new Array(DEPS.length);
        const flushBaseline: unknown[] = new Array(DEPS.length); // per-dependency snapshot at last flush
        let derivedValue: unknown;
        let computeCount = 0;
        let lastSourceValues: Record<string, unknown> | undefined;
        let allDepsPresentAtCompute = false;
        const compute = (deps: unknown[], context: {sourceValues?: Record<string, unknown>}) => {
            computeCount += 1;
            lastSourceValues = context.sourceValues;
            allDepsPresentAtCompute = deps.every((d) => d !== undefined);
            return {computedAt: computeCount};
        };

        const context: {currentValue: unknown; sourceValues?: Record<string, unknown>} = {currentValue: undefined, sourceValues: undefined};
        let pendingFlush: ReturnType<typeof setTimeout> | null = null;
        const recompute = () => {
            if (pendingFlush !== null) {
                return;
            }
            pendingFlush = setTimeout(() => {
                pendingFlush = null;
                // Reconstruct what changed since the last flush by diffing — no per-callback accumulation.
                const sourceValues: Record<string, unknown> = {};
                for (let i = 0; i < DEPS.length; i++) {
                    const key = DEPS[i];
                    if (isCollectionKey(key)) {
                        const delta = getCollectionDelta(dependencyValues[i] as Record<string, unknown>, flushBaseline[i] as Record<string, unknown>);
                        if (delta) {
                            sourceValues[key] = delta;
                        }
                    } else if (dependencyValues[i] !== flushBaseline[i]) {
                        sourceValues[key] = dependencyValues[i];
                    }
                    flushBaseline[i] = dependencyValues[i];
                }
                context.currentValue = derivedValue;
                context.sourceValues = sourceValues;
                derivedValue = compute(dependencyValues, context);
                Onyx.set(ONYXKEYS.DERIVED_ATTRIBUTES, derivedValue as Record<string, unknown>, {skipCacheCheck: true});
            }, 0);
        };

        const connections: Connection[] = DEPS.map((key, i) =>
            Onyx.connectWithoutView({
                key,
                callback: (value) => {
                    dependencyValues[i] = value; // pure option A callback: just accumulate latest + trigger
                    recompute();
                },
            }),
        );

        // Prime the flush baseline with the seeded values (two turns so the priming setTimeout flush runs).
        await act(async () => {
            await waitForPromisesToResolve();
            await waitForPromisesToResolve();
        });
        computeCount = 0;

        await act(async () => {
            Onyx.update(buildCompoundUpdate(1));
            await waitForPromisesToResolve();
            await waitForPromisesToResolve();
        });

        const reportDelta = lastSourceValues?.[ONYXKEYS.COLLECTION.REPORT] as Record<string, unknown> | undefined;
        // eslint-disable-next-line no-console
        console.log(
            `\n[option A + getCollectionDelta] recomputes: ${computeCount}, report delta keys: ${
                reportDelta ? Object.keys(reportDelta).join(',') : 'undefined'
            }, all deps present: ${allDepsPresentAtCompute}\n`,
        );
        expect(computeCount).toBe(1);
        // Recovered the precise changed member (report_1) WITHOUT sourceValues accumulation...
        expect(reportDelta?.[`${ONYXKEYS.COLLECTION.REPORT}1`]).toBeDefined();
        // ...and correctly EXCLUDED the untouched member (report_2) — the fast-path hint plain option A loses.
        expect(reportDelta && `${ONYXKEYS.COLLECTION.REPORT}2` in reportDelta).toBe(false);
        // dependencyValues is fully populated at flush — the reason a single coalesced compute is correct.
        expect(allDepsPresentAtCompute).toBe(true);

        // eslint-disable-next-line unicorn/no-array-for-each
        connections.forEach((c) => Onyx.disconnect(c));
    });
});

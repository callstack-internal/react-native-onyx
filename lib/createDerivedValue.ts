import type {OnyxKey, OnyxValue} from './types';
import type {OnyxStateViewFor} from './useOnyxState';

import {areSameValues, registerDerivedValueReset} from './sharedResults';

type DerivedValuePrevious<T, TDependencies extends readonly OnyxKey[] = readonly OnyxKey[]> = {
    /** The dependencies behind `result`, so `compute` can diff them against the current ones. */
    state: OnyxStateViewFor<TDependencies>;

    result: T;

    /** Returns `result` and changes nothing, so a compute that waits or fails runs again on the next `get`. */
    keep: () => T;
};

type CreateDerivedValueOptions<T, TDependencies extends readonly OnyxKey[] = readonly OnyxKey[]> = {
    /** Keys the value is computed from. Every `useOnyxState` hook that calls `get` must declare at least these. */
    dependencies: TDependencies;

    /** Annotate the return type when reading `previous`, or `T` is inferred as `unknown`. `previous` is undefined on the first compute. */
    compute: (state: OnyxStateViewFor<TDependencies>, previous: DerivedValuePrevious<T, TDependencies> | undefined) => T;
};

type DerivedValue<T, TDependencies extends readonly OnyxKey[] = readonly OnyxKey[]> = {
    dependencies: TDependencies;

    /** Pass the `state` a `useOnyxState` selector gets, never `previousState`. */
    get: (state: OnyxStateViewFor<TDependencies>) => T;

    /** Makes the next `get` compute from scratch. Onyx.clear calls it too. */
    reset: () => void;
};

type Computed<T> = {
    depValues: Array<OnyxValue<OnyxKey>>;
    result: T;
};

/** A value derived from several keys, computed once per change for every `useOnyxState` selector that calls `get`, inline ones included. */
function createDerivedValue<T, const TDependencies extends readonly OnyxKey[]>({dependencies, compute}: CreateDerivedValueOptions<T, TDependencies>): DerivedValue<T, TDependencies> {
    let lastRead: Computed<T> | undefined;
    // What `compute` diffs against, which is the last compute that did not call `keep`.
    let baseline: Computed<T> | undefined;
    // Bumped by `reset`, so a compute that called it does not write its result back as the next baseline.
    let generation = 0;

    function get(state: OnyxStateViewFor<TDependencies>): T {
        const view = state as Record<string, OnyxValue<OnyxKey>>;
        const depValues = dependencies.map((key) => view[key]);
        if (lastRead && areSameValues(depValues, lastRead.depValues)) {
            return lastRead.result;
        }

        let isKept = false;
        let previous: DerivedValuePrevious<T, TDependencies> | undefined;
        if (baseline) {
            const kept = baseline;
            const previousState: Record<string, OnyxValue<OnyxKey>> = {};
            for (let index = 0; index < dependencies.length; index++) {
                previousState[dependencies[index]] = kept.depValues[index];
            }
            previous = {
                state: Object.freeze(previousState) as OnyxStateViewFor<TDependencies>,
                result: kept.result,
                keep: () => {
                    isKept = true;
                    return kept.result;
                },
            };
        }

        const computeGeneration = generation;
        const result = compute(state, previous);
        if (!isKept && computeGeneration === generation) {
            lastRead = {depValues, result};
            baseline = {depValues, result};
        }
        return result;
    }

    function reset() {
        generation++;
        lastRead = undefined;
        baseline = undefined;
    }

    registerDerivedValueReset(reset);

    return {dependencies, get, reset};
}

export default createDerivedValue;
export type {CreateDerivedValueOptions, DerivedValue, DerivedValuePrevious};

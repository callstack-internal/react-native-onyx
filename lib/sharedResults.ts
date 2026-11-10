import type {OnyxKey, OnyxValue} from './types';

type SharedResult = {
    depsKey: string;
    depValues: Array<OnyxValue<OnyxKey>>;
    value: unknown;
    readPreviousState: boolean;
    hadPreviousView: boolean;
};

// Results shared between hooks live in module state, so Onyx.clear drops them with the data they came from.
let sharedResults = new WeakMap<object, SharedResult>();
const derivedValueResets = new Set<() => void>();

function getSharedResult(selector: object): SharedResult | undefined {
    return sharedResults.get(selector);
}

function setSharedResult(selector: object, result: SharedResult) {
    sharedResults.set(selector, result);
}

function registerDerivedValueReset(reset: () => void) {
    derivedValueResets.add(reset);
}

function clearSharedResults() {
    sharedResults = new WeakMap();
    for (const reset of derivedValueResets) {
        reset();
    }
}

function areSameValues(a: Array<OnyxValue<OnyxKey>>, b: Array<OnyxValue<OnyxKey>>): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (!Object.is(a[i], b[i])) {
            return false;
        }
    }
    return true;
}

export {areSameValues, clearSharedResults, getSharedResult, registerDerivedValueReset, setSharedResult};
export type {SharedResult};

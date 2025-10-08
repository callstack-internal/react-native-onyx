/* eslint-disable no-param-reassign */
import {produce, enableMapSet} from 'immer';
import type {OnyxInput, OnyxKey} from './types';
import * as GlobalSettings from './GlobalSettings';

// Enable Map and Set support in Immer
enableMapSet();

type FastMergeOptions = {
    shouldRemoveNestedNulls?: boolean;
    objectRemovalMode?: 'mark' | 'replace' | 'none';
};

type FastMergeReplaceNullPatch = [string[], unknown];

type FastMergeResult<TValue> = {
    result: TValue;
    replaceNullPatches: FastMergeReplaceNullPatch[];
};

const ONYX_INTERNALS__REPLACE_OBJECT_MARK = 'ONYX_INTERNALS__REPLACE_OBJECT_MARK';

/**
 * Immer-based merge function that replaces the current fastMerge implementation
 */
function fastMergeImmer<TValue>(target: TValue, source: TValue, options?: FastMergeOptions): FastMergeResult<TValue> {
    const optionsWithDefaults: FastMergeOptions = {
        shouldRemoveNestedNulls: options?.shouldRemoveNestedNulls ?? false,
        objectRemovalMode: options?.objectRemovalMode ?? 'none',
    };

    // Handle arrays and nullish values
    if (Array.isArray(source) || source === null || source === undefined) {
        return {result: source, replaceNullPatches: []};
    }

    // Handle null target (replacement case)
    if (target === null && optionsWithDefaults.objectRemovalMode === 'mark') {
        const markedSource = {...(source as Record<string, unknown>)};
        (markedSource as Record<string, unknown>)[ONYX_INTERNALS__REPLACE_OBJECT_MARK] = true;
        return {
            result: markedSource as TValue,
            replaceNullPatches: [[[], source]],
        };
    }

    // Handle array target with object source - replace entirely
    if (Array.isArray(target) && typeof source === 'object' && source !== null) {
        return {result: source, replaceNullPatches: []};
    }

    // Use Immer for all merge operations when enabled via GlobalSettings
    // For simple cases, use a lightweight approach to avoid memory overhead
    if (typeof target === 'object' && target !== null && typeof source === 'object' && source !== null) {
        const mergedValue = produce(target as Record<string, unknown>, (draft: Record<string, unknown>) => {
            mergeObjectImmer(draft, source as Record<string, unknown>, optionsWithDefaults);
        });

        // Generate replaceNullPatches for mark mode
        const replaceNullPatches: FastMergeReplaceNullPatch[] = [];
        if (optionsWithDefaults.objectRemovalMode === 'mark') {
            generateReplaceNullPatches(target as Record<string, unknown>, source as Record<string, unknown>, [], replaceNullPatches);
        }

        return {result: mergedValue as TValue, replaceNullPatches};
    }

    // For non-object cases, return source directly
    return {result: source, replaceNullPatches: []};
}

/**
 * Immer-based object merging that handles nested objects and null removal
 */
function mergeObjectImmer(draft: Record<string, unknown>, source: Record<string, unknown>, options: FastMergeOptions): void {
    Object.keys(source).forEach((key) => {
        const sourceProperty = source[key];

        // Skip undefined values
        if (sourceProperty === undefined) {
            return;
        }

        // Handle null removal
        if (options.shouldRemoveNestedNulls && sourceProperty === null) {
            delete draft[key];
            return;
        }

        // Handle object replacement marks
        if (
            options.objectRemovalMode === 'replace' &&
            typeof sourceProperty === 'object' &&
            sourceProperty !== null &&
            (sourceProperty as Record<string, unknown>)[ONYX_INTERNALS__REPLACE_OBJECT_MARK]
        ) {
            const cleanSource = {...sourceProperty};
            delete (cleanSource as Record<string, unknown>)[ONYX_INTERNALS__REPLACE_OBJECT_MARK];
            draft[key] = cleanSource;
            return;
        }

        // Handle mark mode - when target is null, mark the source
        if (options.objectRemovalMode === 'mark' && draft[key] === null) {
            const markedSource = {...(sourceProperty as Record<string, unknown>)};
            (markedSource as Record<string, unknown>)[ONYX_INTERNALS__REPLACE_OBJECT_MARK] = true;
            draft[key] = markedSource;
            return;
        }

        // Handle arrays - replace entirely
        if (Array.isArray(sourceProperty)) {
            draft[key] = sourceProperty;
            return;
        }

        // Handle primitive values
        if (sourceProperty === null || typeof sourceProperty !== 'object') {
            draft[key] = sourceProperty;
            return;
        }

        // Handle nested objects
        if (typeof draft[key] === 'object' && draft[key] !== null && !Array.isArray(draft[key])) {
            mergeObjectImmer(draft[key] as Record<string, unknown>, sourceProperty as Record<string, unknown>, options);
        } else {
            draft[key] = sourceProperty;
        }

        // Post-process to remove nested nulls if needed
        if (options.shouldRemoveNestedNulls && typeof draft[key] === 'object' && draft[key] !== null && !Array.isArray(draft[key])) {
            const cleanedValue = removeNestedNullValuesImmer(draft[key]);
            if (Object.keys(cleanedValue as Record<string, unknown>).length === 0) {
                delete draft[key];
            } else {
                draft[key] = cleanedValue;
            }
        }
    });
}

/**
 * Generate replace null patches for mark mode
 */
function generateReplaceNullPatches(target: Record<string, unknown>, source: Record<string, unknown>, basePath: string[], patches: FastMergeReplaceNullPatch[]): void {
    Object.keys(source).forEach((key) => {
        const sourceProperty = source[key];
        const targetProperty = target[key];

        if (sourceProperty === undefined) {
            return;
        }

        if (targetProperty === null && typeof sourceProperty === 'object' && sourceProperty !== null) {
            patches.push([[...basePath, key], sourceProperty]);
        } else if (typeof sourceProperty === 'object' && sourceProperty !== null && !Array.isArray(sourceProperty)) {
            generateReplaceNullPatches((targetProperty as Record<string, unknown>) || {}, sourceProperty as Record<string, unknown>, [...basePath, key], patches);
        }
    });
}

/**
 * Remove nested null values using Immer
 */
function removeNestedNullValuesImmer<TValue extends OnyxInput<OnyxKey> | null>(value: TValue): TValue {
    if (value === null || value === undefined || typeof value !== 'object') {
        return value;
    }

    if (Array.isArray(value)) {
        // Recursively process array elements
        return value.map((item) => removeNestedNullValuesImmer(item)).filter((item) => item !== null) as TValue;
    }

    // Use a recursive approach similar to the original implementation
    const result: Record<string, unknown> = {};

    // eslint-disable-next-line no-restricted-syntax, guard-for-in
    for (const key in value) {
        const propertyValue = value[key];

        if (propertyValue === null || propertyValue === undefined) {
            // eslint-disable-next-line no-continue
            continue;
        }

        if (typeof propertyValue === 'object' && !Array.isArray(propertyValue)) {
            const valueWithoutNestedNulls = removeNestedNullValuesImmer(propertyValue);
            result[key] = valueWithoutNestedNulls;
        } else {
            result[key] = propertyValue;
        }
    }

    return result as TValue;
}

export default {
    fastMerge: fastMergeImmer,
    removeNestedNullValues: removeNestedNullValuesImmer,
    ONYX_INTERNALS__REPLACE_OBJECT_MARK,
};
export type {FastMergeResult, FastMergeReplaceNullPatch, FastMergeOptions};

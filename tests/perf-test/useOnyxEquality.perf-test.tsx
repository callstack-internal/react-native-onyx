import {act, screen} from '@testing-library/react-native';
import {shallowEqual} from 'fast-equals';
import React from 'react';
import {Text} from 'react-native';
import {measureRenders} from 'reassure';
import type {OnyxKey, UseOnyxOptions} from '../../lib';
import Onyx, {useOnyx} from '../../lib';

/**
 * Selector output shapes crossed with output equality functions (expensify-issues#3044).
 * Each scenario mounts one collection-root subscriber, then writes UPDATES times to a member the
 * selector leaves out, so the output stays content-equal and only the equality function decides
 * whether the subscriber re-renders.
 */

const ONYXKEYS = {
    COLLECTION: {
        TEST_KEY: 'test_',
    },
};

const MEMBERS = 10000;
const UPDATES = 5;
const KEY = ONYXKEYS.COLLECTION.TEST_KEY;
const IGNORED_MEMBER_KEY = `${KEY}0`;

type Member = {
    id: string;
    name: string;
    type: 'expense' | 'chat';
    total: number;
    owner: {accountID: number; login: string};
    participants: Record<string, {role: string}>;
};

type Collection = Record<string, Member> | undefined;

function createCollection(): Record<string, Member> {
    return Object.fromEntries(
        Array.from({length: MEMBERS}, (_, index) => [
            `${KEY}${index}`,
            {
                id: String(index),
                name: `member${index}`,
                // Member 0 is the only one the selectors leave out, and the only one the scenario writes to.
                type: index === 0 ? 'chat' : 'expense',
                total: index,
                owner: {accountID: index, login: `user${index}@test.com`},
                participants: {
                    [index]: {role: 'admin'},
                    [index + 1]: {role: 'member'},
                },
            },
        ]),
    );
}

const expenseMembers = (collection: Collection) => Object.values(collection ?? {}).filter((member) => member.type === 'expense');

const SELECTORS = {
    /** One number. */
    scalar: (collection: Collection) => expenseMembers(collection).length,
    /** New array, members keep their cached references. */
    sharedMembersArray: (collection: Collection) => expenseMembers(collection),
    /** New array of strings. */
    idsArray: (collection: Collection) => expenseMembers(collection).map((member) => member.id),
    /** New array of new flat objects. */
    pickedObjectsArray: (collection: Collection) =>
        expenseMembers(collection).map((member) => ({
            id: member.id,
            name: member.name,
            total: member.total,
        })),
    /** New record of new nested objects, the worst case for a deep compare. */
    clonedNestedRecord: (collection: Collection) =>
        Object.fromEntries(
            expenseMembers(collection).map((member) => [
                member.id,
                {
                    ...member,
                    owner: {...member.owner},
                    participants: {...member.participants},
                },
            ]),
        ),
};

type SelectorName = keyof typeof SELECTORS;

const EQUALITIES = {
    deepEqual: undefined,
    shallowEqual,
    objectIs: Object.is,
};

type EqualityName = keyof typeof EQUALITIES;

/** Re-renders caused by the UPDATES content-equal writes. 0 means the equality function deduped them all. */
const EXPECTED_EXTRA_RENDERS: Record<EqualityName, Record<SelectorName, number>> = {
    deepEqual: {
        scalar: 0,
        sharedMembersArray: 0,
        idsArray: 0,
        pickedObjectsArray: 0,
        clonedNestedRecord: 0,
    },
    shallowEqual: {
        scalar: 0,
        sharedMembersArray: 0,
        idsArray: 0,
        pickedObjectsArray: UPDATES,
        clonedNestedRecord: UPDATES,
    },
    objectIs: {
        scalar: 0,
        sharedMembersArray: UPDATES,
        idsArray: UPDATES,
        pickedObjectsArray: UPDATES,
        clonedNestedRecord: UPDATES,
    },
};

let renderCount = 0;

function Subscriber({options}: {options: UseOnyxOptions<OnyxKey, unknown>}) {
    const [data] = useOnyx(KEY, options);
    renderCount++;
    return <Text>{data === undefined ? 'loading' : 'ready'}</Text>;
}

describe('useOnyx selector output equality', () => {
    beforeAll(() => {
        Onyx.init({keys: ONYXKEYS});
    });

    afterEach(async () => {
        await Onyx.clear();
    });

    describe.each(Object.keys(EQUALITIES) as EqualityName[])('%s', (equalityName) => {
        test.each(Object.keys(SELECTORS) as SelectorName[])('%s', async (selectorName) => {
            // Given a subscriber on a large collection with this selector shape and equality function
            const options = {
                selector: SELECTORS[selectorName],
                equality: EQUALITIES[equalityName],
            } as UseOnyxOptions<OnyxKey, unknown>;

            await measureRenders(<Subscriber options={options} />, {
                beforeEach: async () => {
                    await Onyx.mergeCollection(KEY, createCollection());
                    renderCount = 0;
                },
                scenario: async () => {
                    await screen.findByText('ready');
                    const mountRenders = renderCount;

                    // When a member the selector leaves out changes, so the output is content-equal each time
                    for (let update = 1; update <= UPDATES; update++) {
                        await act(async () => {
                            await Onyx.merge(IGNORED_MEMBER_KEY, {
                                total: -update,
                            });
                        });
                    }

                    // Then the subscriber re-renders only when the equality function cannot tell the outputs are equal
                    expect(renderCount - mountRenders).toBe(EXPECTED_EXTRA_RENDERS[equalityName][selectorName]);
                },
                afterEach: async () => {
                    await Onyx.clear();
                },
            });
        });
    });
});

import {measureFunction} from 'reassure';
import OnyxKeyUtils from '../../lib/OnyxKeyUtils';
import Onyx from '../../lib/Onyx';

const ONYXKEYS = {
    TEST_KEY: 'test',
    TEST_KEY_2: 'test2',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_NESTED_KEY: 'test_nested_',
        TEST_NESTED_NESTED_KEY: 'test_nested_nested_',
        TEST_KEY_2: 'test2_',
        TEST_KEY_3: 'test3_',
        TEST_KEY_4: 'test4_',
        TEST_KEY_5: 'test5_',
        EVICTABLE_TEST_KEY: 'evictable_test_',
        SNAPSHOT: 'snapshot_',
    },
};

const evictableKeys = [ONYXKEYS.COLLECTION.EVICTABLE_TEST_KEY];

const initialKeyStates = {};

const collectionKey = ONYXKEYS.COLLECTION.TEST_KEY;

describe('OnyxKeyUtils', () => {
    beforeAll(async () => {
        Onyx.init({
            keys: ONYXKEYS,
            maxCachedKeysCount: 100000,
            evictableKeys,
            initialKeyStates,
            skippableCollectionMemberIDs: ['skippable-id'],
        });
    });

    afterEach(async () => {
        await Onyx.clear();
    });

    describe('isCollectionKey', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxKeyUtils.isCollectionKey(collectionKey));
        });
    });

    describe('isCollectionMemberKey', () => {
        const collectionKeyLength = collectionKey.length;

        test('one call with correct key', async () => {
            await measureFunction(() => OnyxKeyUtils.isCollectionMemberKey(collectionKey, `${collectionKey}entry1`, collectionKeyLength));
        });

        test('one call with wrong key', async () => {
            await measureFunction(() => OnyxKeyUtils.isCollectionMemberKey(collectionKey, `${ONYXKEYS.COLLECTION.TEST_KEY_2}entry1`, collectionKeyLength));
        });
    });

    describe('isKeyMatch', () => {
        test('one call passing normal key', async () => {
            await measureFunction(() => OnyxKeyUtils.isKeyMatch(ONYXKEYS.TEST_KEY, ONYXKEYS.TEST_KEY_2));
        });

        test('one call passing collection key', async () => {
            await measureFunction(() => OnyxKeyUtils.isKeyMatch(collectionKey, `${collectionKey}entry1`));
        });
    });

    describe('getCollectionKeys', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxKeyUtils.getCollectionKeys());
        });
    });

    describe('getCollectionKey', () => {
        test('one call', async () => {
            await measureFunction(() => OnyxKeyUtils.getCollectionKey(`${ONYXKEYS.COLLECTION.TEST_NESTED_NESTED_KEY}entry1`));
        });
    });

    describe('splitCollectionMemberKey', () => {
        test('one call without passing the collection key', async () => {
            await measureFunction(() => OnyxKeyUtils.splitCollectionMemberKey(`${collectionKey}entry1`));
        });

        test('one call passing the collection key', async () => {
            await measureFunction(() => OnyxKeyUtils.splitCollectionMemberKey(`${collectionKey}entry1`, collectionKey));
        });
    });
});

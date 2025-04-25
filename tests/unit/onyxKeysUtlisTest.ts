import Onyx from '../../lib';
import OnyxKeyUtils from '../../lib/OnyxKeyUtils';

const ONYXKEYS = {
    TEST_KEY: 'test',
    COLLECTION: {
        TEST_KEY: 'test_',
        TEST_LEVEL_KEY: 'test_level_',
        TEST_LEVEL_LAST_KEY: 'test_level_last_',
    },
};

Onyx.init({
    keys: ONYXKEYS,
});

beforeEach(() => Onyx.clear());
describe('OnyxKeyUtils', () => {
    it('should throw error if key does not contain underscore', () => {
        expect(() => {
            OnyxKeyUtils.getCollectionKey(ONYXKEYS.TEST_KEY);
        }).toThrowError("Invalid 'test' key provided, only collection keys are allowed.");
        expect(() => {
            OnyxKeyUtils.getCollectionKey('');
        }).toThrowError("Invalid '' key provided, only collection keys are allowed.");
    });
});

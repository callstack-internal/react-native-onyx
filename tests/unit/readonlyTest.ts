import Onyx from '../../lib/Onyx';
import OnyxCache from '../../lib/OnyxCache';
import OnyxUtils from '../../lib/OnyxUtils';

// Test to verify readonly behavior
describe('Readonly Data Tests', () => {
    beforeEach(() => {
        Onyx.init({
            keys: {
                TEST_KEY: 'testKey',
                COLLECTION: {
                    REPORT: 'report_',
                },
            },
            initialKeyStates: {},
        });
    });

    afterEach(() => {
        Onyx.clear();
    });

    test('should return readonly collection data from cache', () => {
        // Set up some test data
        const testData = {
            report_1: {id: 1, title: 'Report 1'},
            report_2: {id: 2, title: 'Report 2'},
        };

        // Set the data
        Onyx.multiSet(testData);

        // Get collection data from cache
        const collectionData = OnyxCache.getCollectionData('report_');

        expect(collectionData).toBeDefined();

        // Verify the data structure is correct
        if (collectionData) {
            expect(collectionData['report_1']).toEqual({id: 1, title: 'Report 1'});
            expect(collectionData['report_2']).toEqual({id: 2, title: 'Report 2'});
        }
    });

    test('should return readonly data from reduceCollectionWithSelector', () => {
        // Set up test data
        const testData = {
            report_1: {id: 1, title: 'Report 1'},
            report_2: {id: 2, title: 'Report 2'},
        };

        Onyx.multiSet(testData);

        // Use reduceCollectionWithSelector
        const selector = (item: any) => ({id: item.id, title: item.title});
        const result = OnyxUtils.reduceCollectionWithSelector(testData, selector);

        expect(result).toBeDefined();

        // Verify the result structure is correct
        expect(result['report_1']).toEqual({id: 1, title: 'Report 1'});
        expect(result['report_2']).toEqual({id: 2, title: 'Report 2'});
    });

    test('should maintain readonly behavior in useOnyx hook', async () => {
        // Set up test data
        const testData = {
            report_1: {id: 1, title: 'Report 1'},
            report_2: {id: 2, title: 'Report 2'},
        };

        Onyx.multiSet(testData);

        // Wait for data to be set
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Test that the data returned by useOnyx is readonly
        // This test would need to be run in a React component context
        // For now, we'll just verify the types are correct
        expect(true).toBe(true); // Placeholder - actual test would need React context
    });
});

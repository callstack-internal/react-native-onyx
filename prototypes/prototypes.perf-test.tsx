/**
 * Performance Comparison Test using Reassure
 * Compares KeyBased vs StoreBased vs ProxyBased vs ObserverBased implementations
 *
 * Usage:
 * 1. Set PROTOTYPE env variable to the prototype you want to test
 * 2. Run: PROTOTYPE=KeyBased npm run perf-test -- --testNamePattern="Prototype Comparison"
 * 3. Compare results using the generated output files
 *
 * Or use the helper script: npm run prototype-perf-compare
 */

import React from 'react';
import {View, Text} from 'react-native';
import {act} from '@testing-library/react-native';
import {measureAsyncFunction, measureFunction, measureRenders} from 'reassure';

// Helper to dynamically load the correct prototype
function getOnyxImplementation() {
    const prototype = process.env.PROTOTYPE || 'KeyBased';

    switch (prototype) {
        case 'KeyBased':
            return require('./KeyBased/Onyx').default;
        case 'StoreBased':
            return require('./StoreBased/Onyx').default;
        case 'ProxyBased':
            return require('./ProxyBased/Onyx').default;
        case 'ObserverBased':
            return require('./ObserverBased/Onyx').default;
        default:
            throw new Error(`Unknown prototype: ${prototype}`);
    }
}

// Helper to dynamically load useOnyx
function getUseOnyxImplementation() {
    const prototype = process.env.PROTOTYPE || 'KeyBased';

    switch (prototype) {
        case 'KeyBased':
            return require('./KeyBased/useOnyx').default;
        case 'StoreBased':
            return require('./StoreBased/useOnyx').default;
        case 'ProxyBased':
            return require('./ProxyBased/useOnyx').default;
        case 'ObserverBased':
            return require('./ObserverBased/useOnyx').default;
        default:
            throw new Error(`Unknown prototype: ${prototype}`);
    }
}

const Onyx = getOnyxImplementation();
const useOnyx = getUseOnyxImplementation();
const prototypeName = process.env.PROTOTYPE || 'KeyBased';

// Helper to generate report objects
function generateReport(id: number) {
    return {
        reportID: `report_${id}`,
        reportName: `Report ${id}`,
        total: id * 100,
        currency: 'USD',
        participants: [`user_${id % 10}`, `user_${(id + 1) % 10}`],
        status: id % 2 === 0 ? 'open' : 'closed',
        description: `This is report number ${id} with some description text`,
        createdAt: Date.now() - id * 1000,
        updatedAt: Date.now(),
        metadata: {
            category: `Category ${id % 5}`,
            tags: [`tag${id % 3}`, `tag${(id + 1) % 3}`],
            priority: id % 3,
        },
    };
}

// Helper to generate a collection of reports
function generateReportsCollection(count: number) {
    const collection: Record<string, any> = {};
    for (let i = 0; i < count; i++) {
        collection[`report_${i}`] = generateReport(i);
    }
    return collection;
}

// Cleanup helper
async function cleanup() {
    try {
        await Onyx.clear();
    } catch (e) {
        // Ignore cleanup errors
    }
}

describe(`Prototype Comparison - ${prototypeName}`, () => {
    beforeAll(async () => {
        await Onyx.init({maxCachedKeysCount: 10000});
    });

    afterEach(async () => {
        await cleanup();
    });

    describe('Basic Operations', () => {
        test('set - 1000 individual key sets', async () => {
            await measureAsyncFunction(
                async () => {
                    for (let i = 0; i < 1000; i++) {
                        await Onyx.set(`report_${i}`, generateReport(i));
                    }
                },
                {afterEach: cleanup},
            );
        });

        test('merge - 1000 individual key merges', async () => {
            await measureAsyncFunction(
                async () => {
                    for (let i = 0; i < 1000; i++) {
                        await Onyx.merge(`report_${i}`, generateReport(i));
                    }
                },
                {afterEach: cleanup},
            );
        });

        test('get - 1000 cached reads', async () => {
            await measureAsyncFunction(
                async () => {
                    for (let i = 0; i < 1000; i++) {
                        await Onyx.get(`report_${i}`);
                    }
                },
                {
                    beforeEach: async () => {
                        // Pre-populate cache
                        for (let i = 0; i < 1000; i++) {
                            await Onyx.set(`report_${i}`, generateReport(i));
                        }
                    },
                    afterEach: cleanup,
                },
            );
        });

        test('clear - with 1000 keys', async () => {
            await measureAsyncFunction(
                async () => {
                    await Onyx.clear();
                },
                {
                    beforeEach: async () => {
                        // Pre-populate
                        for (let i = 0; i < 1000; i++) {
                            await Onyx.set(`report_${i}`, generateReport(i));
                        }
                    },
                },
            );
        });
    });

    describe('Collection Operations', () => {
        test('mergeCollection - bulk insert 1000 items', async () => {
            await measureAsyncFunction(
                async () => {
                    const collection = generateReportsCollection(1000);
                    await Onyx.mergeCollection('report_', collection);
                },
                {afterEach: cleanup},
            );
        });

        test('mergeCollection - update 500 of 1000 items', async () => {
            await measureAsyncFunction(
                async () => {
                    const updates: Record<string, any> = {};
                    for (let i = 0; i < 500; i++) {
                        updates[`report_${i}`] = {status: 'updated', updatedAt: Date.now()};
                    }
                    await Onyx.mergeCollection('report_', updates);
                },
                {
                    beforeEach: async () => {
                        const collection = generateReportsCollection(1000);
                        await Onyx.mergeCollection('report_', collection);
                    },
                    afterEach: cleanup,
                },
            );
        });
    });

    describe('Subscription Performance', () => {
        test('subscribe - 100 subscribers to same key', async () => {
            await measureFunction(
                () => {
                    const connections = [];
                    for (let i = 0; i < 100; i++) {
                        const conn = Onyx.connect({
                            key: 'shared_key',
                            callback: () => {},
                        });
                        connections.push(conn);
                    }
                    // Cleanup
                    connections.forEach((conn) => Onyx.disconnect(conn));
                },
                {
                    beforeEach: async () => {
                        await Onyx.set('shared_key', {value: 0});
                    },
                    afterEach: cleanup,
                },
            );
        });

        test('subscribe - 100 subscribers to different keys', async () => {
            await measureFunction(
                () => {
                    const connections = [];
                    for (let i = 0; i < 100; i++) {
                        const conn = Onyx.connect({
                            key: `key_${i}`,
                            callback: () => {},
                        });
                        connections.push(conn);
                    }
                    // Cleanup
                    connections.forEach((conn) => Onyx.disconnect(conn));
                },
                {
                    beforeEach: async () => {
                        for (let i = 0; i < 100; i++) {
                            await Onyx.set(`key_${i}`, {value: i});
                        }
                    },
                    afterEach: cleanup,
                },
            );
        });

        test('notify - update key with 50 subscribers', async () => {
            await measureAsyncFunction(
                async () => {
                    for (let i = 0; i < 100; i++) {
                        await Onyx.set('shared_key', {value: i, timestamp: Date.now()});
                    }
                },
                {
                    beforeEach: async () => {
                        await Onyx.set('shared_key', {value: 0});
                        // Create 50 subscribers
                        const connections = [];
                        for (let i = 0; i < 50; i++) {
                            const conn = Onyx.connect({
                                key: 'shared_key',
                                callback: () => {
                                    // Simulate light work
                                    const x = Math.random();
                                },
                            });
                            connections.push(conn);
                        }
                        // Store for cleanup in afterEach
                        (global as any).__testConnections = connections;
                    },
                    afterEach: async () => {
                        const connections = (global as any).__testConnections || [];
                        connections.forEach((conn: number) => Onyx.disconnect(conn));
                        delete (global as any).__testConnections;
                        await cleanup();
                    },
                },
            );
        });

        test('notify - scattered updates with 100 total subscribers', async () => {
            await measureAsyncFunction(
                async () => {
                    // Update 10 different keys, each has 10 subscribers
                    for (let i = 0; i < 10; i++) {
                        await Onyx.set(`key_${i}`, {value: i, timestamp: Date.now()});
                    }
                },
                {
                    beforeEach: async () => {
                        const connections = [];
                        // Create 10 subscribers for each of 10 keys
                        for (let keyIndex = 0; keyIndex < 10; keyIndex++) {
                            await Onyx.set(`key_${keyIndex}`, {value: keyIndex});
                            for (let subIndex = 0; subIndex < 10; subIndex++) {
                                const conn = Onyx.connect({
                                    key: `key_${keyIndex}`,
                                    callback: () => {
                                        const x = Math.random();
                                    },
                                });
                                connections.push(conn);
                            }
                        }
                        (global as any).__testConnections = connections;
                    },
                    afterEach: async () => {
                        const connections = (global as any).__testConnections || [];
                        connections.forEach((conn: number) => Onyx.disconnect(conn));
                        delete (global as any).__testConnections;
                        await cleanup();
                    },
                },
            );
        });
    });

    describe('Mixed Workload', () => {
        test('realistic workload - reads, writes, and subscriptions', async () => {
            await measureAsyncFunction(
                async () => {
                    // Simulate realistic app usage
                    // 1. Subscribe to some keys
                    const connections = [];
                    for (let i = 0; i < 10; i++) {
                        const conn = Onyx.connect({
                            key: `report_${i}`,
                            callback: () => {},
                        });
                        connections.push(conn);
                    }

                    // 2. Read some data
                    for (let i = 0; i < 50; i++) {
                        await Onyx.get(`report_${i}`);
                    }

                    // 3. Update some data
                    for (let i = 0; i < 20; i++) {
                        await Onyx.merge(`report_${i}`, {
                            status: 'updated',
                            updatedAt: Date.now(),
                        });
                    }

                    // 4. Add new data
                    for (let i = 1000; i < 1020; i++) {
                        await Onyx.set(`report_${i}`, generateReport(i));
                    }

                    // Cleanup
                    connections.forEach((conn) => Onyx.disconnect(conn));
                },
                {
                    beforeEach: async () => {
                        // Pre-populate with 100 reports
                        for (let i = 0; i < 100; i++) {
                            await Onyx.set(`report_${i}`, generateReport(i));
                        }
                    },
                    afterEach: cleanup,
                },
            );
        });
    });

    describe('Memory and Cache', () => {
        test('cache thrashing - exceed cache size', async () => {
            await measureAsyncFunction(
                async () => {
                    // Set more items than cache can hold
                    for (let i = 0; i < 2000; i++) {
                        await Onyx.set(`report_${i}`, generateReport(i));
                    }
                    // Read them back (some from cache, some from storage)
                    for (let i = 0; i < 2000; i++) {
                        await Onyx.get(`report_${i}`);
                    }
                },
                {
                    beforeEach: async () => {
                        // Init with smaller cache
                        await Onyx.init({maxCachedKeysCount: 1000});
                    },
                    afterEach: cleanup,
                },
            );
        });
    });

    describe('Large Objects', () => {
        test('large object - single 10KB object', async () => {
            await measureAsyncFunction(
                async () => {
                    const largeObject = {
                        id: 'large_report',
                        data: new Array(1000).fill(0).map((_, i) => ({
                            index: i,
                            value: `item_${i}`,
                            metadata: {timestamp: Date.now(), random: Math.random()},
                        })),
                    };
                    await Onyx.set('large_report', largeObject);
                    await Onyx.get('large_report');
                },
                {afterEach: cleanup},
            );
        });

        test('large object - merge deeply nested object', async () => {
            await measureAsyncFunction(
                async () => {
                    await Onyx.merge('large_report', {
                        data: {
                            level1: {
                                level2: {
                                    level3: {
                                        value: 'updated',
                                        timestamp: Date.now(),
                                    },
                                },
                            },
                        },
                    });
                },
                {
                    beforeEach: async () => {
                        await Onyx.set('large_report', {
                            id: 'large_report',
                            data: {
                                level1: {
                                    level2: {
                                        level3: {
                                            value: 'original',
                                        },
                                    },
                                },
                            },
                        });
                    },
                    afterEach: cleanup,
                },
            );
        });
    });

    describe('useOnyx Hook Performance', () => {
        // Test component that uses useOnyx
        function TestComponent({testKey}: {testKey: string}) {
            const [data] = useOnyx(testKey);
            return (
                <View>
                    <Text>{data ? JSON.stringify(data) : 'No data'}</Text>
                </View>
            );
        }

        // Component with selector
        function TestComponentWithSelector({testKey}: {testKey: string}) {
            const [status] = useOnyx(testKey, {
                selector: (report: any) => report?.status,
            });
            return (
                <View>
                    <Text>{status || 'No status'}</Text>
                </View>
            );
        }

        // Component with multiple useOnyx calls
        function TestComponentMultipleHooks({keys}: {keys: string[]}) {
            const [data1] = useOnyx(keys[0]);
            const [data2] = useOnyx(keys[1]);
            const [data3] = useOnyx(keys[2]);
            return (
                <View>
                    <Text>{data1 ? 'Data1' : 'No data1'}</Text>
                    <Text>{data2 ? 'Data2' : 'No data2'}</Text>
                    <Text>{data3 ? 'Data3' : 'No data3'}</Text>
                </View>
            );
        }

        test('useOnyx - initial render with cached data', async () => {
            await measureRenders(<TestComponent testKey="report_1" />, {
                beforeEach: async () => {
                    await Onyx.set('report_1', generateReport(1));
                },
                afterEach: cleanup,
            });
        });

        test('useOnyx - initial render without cached data', async () => {
            await measureRenders(<TestComponent testKey="report_1" />, {afterEach: cleanup});
        });

        test('useOnyx - re-render on data update', async () => {
            await measureRenders(<TestComponent testKey="shared_report" />, {
                beforeEach: async () => {
                    await Onyx.set('shared_report', generateReport(1));
                },
                afterEach: cleanup,
                scenario: async () => {
                    // Trigger updates that will cause re-renders
                    for (let i = 0; i < 10; i++) {
                        await act(async () => {
                            await Onyx.merge('shared_report', {
                                status: `status_${i}`,
                                updatedAt: Date.now(),
                            });
                        });
                    }
                },
            });
        });

        test('useOnyx - with selector', async () => {
            await measureRenders(<TestComponentWithSelector testKey="report_1" />, {
                beforeEach: async () => {
                    await Onyx.set('report_1', generateReport(1));
                },
                afterEach: cleanup,
            });
        });

        test('useOnyx - selector with data updates', async () => {
            await measureRenders(<TestComponentWithSelector testKey="shared_report" />, {
                beforeEach: async () => {
                    await Onyx.set('shared_report', generateReport(1));
                },
                afterEach: cleanup,
                scenario: async () => {
                    // Update data 10 times - selector should prevent unnecessary re-renders
                    // when non-selected fields change
                    for (let i = 0; i < 10; i++) {
                        await act(async () => {
                            await Onyx.merge('shared_report', {
                                updatedAt: Date.now(),
                                description: `Updated ${i}`,
                            });
                        });
                    }
                    // Now update the selected field
                    await act(async () => {
                        await Onyx.merge('shared_report', {status: 'updated'});
                    });
                },
            });
        });

        test('useOnyx - multiple hooks in one component', async () => {
            await measureRenders(<TestComponentMultipleHooks keys={['report_1', 'report_2', 'report_3']} />, {
                beforeEach: async () => {
                    await Onyx.set('report_1', generateReport(1));
                    await Onyx.set('report_2', generateReport(2));
                    await Onyx.set('report_3', generateReport(3));
                },
                afterEach: cleanup,
            });
        });

        test('useOnyx - multiple hooks with updates', async () => {
            await measureRenders(<TestComponentMultipleHooks keys={['report_1', 'report_2', 'report_3']} />, {
                beforeEach: async () => {
                    await Onyx.set('report_1', generateReport(1));
                    await Onyx.set('report_2', generateReport(2));
                    await Onyx.set('report_3', generateReport(3));
                },
                afterEach: cleanup,
                scenario: async () => {
                    // Update each key multiple times
                    for (let i = 0; i < 5; i++) {
                        await act(async () => {
                            await Onyx.merge('report_1', {status: `status1_${i}`});
                            await Onyx.merge('report_2', {status: `status2_${i}`});
                            await Onyx.merge('report_3', {status: `status3_${i}`});
                        });
                    }
                },
            });
        });

        test('useOnyx - collection member updates', async () => {
            await measureRenders(<TestComponent testKey="report_50" />, {
                beforeEach: async () => {
                    // Create a collection of 100 reports
                    const collection = generateReportsCollection(100);
                    await Onyx.mergeCollection('report_', collection);
                },
                afterEach: cleanup,
                scenario: async () => {
                    // Update the specific member we're watching
                    for (let i = 0; i < 10; i++) {
                        await act(async () => {
                            await Onyx.merge('report_50', {
                                status: `updated_${i}`,
                                updatedAt: Date.now(),
                            });
                        });
                    }
                },
            });
        });

        test('useOnyx - stress test with 20 hooks', async () => {
            function StressTestComponent() {
                // Use 20 hooks properly (not in a loop)
                const [data0] = useOnyx('stress_key_0');
                const [data1] = useOnyx('stress_key_1');
                const [data2] = useOnyx('stress_key_2');
                const [data3] = useOnyx('stress_key_3');
                const [data4] = useOnyx('stress_key_4');
                const [data5] = useOnyx('stress_key_5');
                const [data6] = useOnyx('stress_key_6');
                const [data7] = useOnyx('stress_key_7');
                const [data8] = useOnyx('stress_key_8');
                const [data9] = useOnyx('stress_key_9');
                const [data10] = useOnyx('stress_key_10');
                const [data11] = useOnyx('stress_key_11');
                const [data12] = useOnyx('stress_key_12');
                const [data13] = useOnyx('stress_key_13');
                const [data14] = useOnyx('stress_key_14');
                const [data15] = useOnyx('stress_key_15');
                const [data16] = useOnyx('stress_key_16');
                const [data17] = useOnyx('stress_key_17');
                const [data18] = useOnyx('stress_key_18');
                const [data19] = useOnyx('stress_key_19');

                const allData = [data0, data1, data2, data3, data4, data5, data6, data7, data8, data9, data10, data11, data12, data13, data14, data15, data16, data17, data18, data19];

                return (
                    <View>
                        <Text>{allData.filter(Boolean).length} loaded</Text>
                    </View>
                );
            }

            await measureRenders(<StressTestComponent />, {
                beforeEach: async () => {
                    // Pre-populate all keys
                    for (let i = 0; i < 20; i++) {
                        await Onyx.set(`stress_key_${i}`, {value: i});
                    }
                },
                afterEach: cleanup,
                scenario: async () => {
                    // Update all keys
                    for (let i = 0; i < 20; i++) {
                        await act(async () => {
                            await Onyx.merge(`stress_key_${i}`, {value: i + 100});
                        });
                    }
                },
            });
        });
    });
});

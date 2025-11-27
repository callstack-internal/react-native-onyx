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

import {measureAsyncFunction, measureFunction} from 'reassure';

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

const Onyx = getOnyxImplementation();
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
            await measureAsyncFunction(async () => {
                for (let i = 0; i < 1000; i++) {
                    await Onyx.set(`report_${i}`, generateReport(i));
                }
            }, {afterEach: cleanup});
        });

        test('merge - 1000 individual key merges', async () => {
            await measureAsyncFunction(async () => {
                for (let i = 0; i < 1000; i++) {
                    await Onyx.merge(`report_${i}`, generateReport(i));
                }
            }, {afterEach: cleanup});
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
            await measureAsyncFunction(async () => {
                const collection = generateReportsCollection(1000);
                await Onyx.mergeCollection('report_', collection);
            }, {afterEach: cleanup});
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
            await measureAsyncFunction(async () => {
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
            }, {afterEach: cleanup});
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
});

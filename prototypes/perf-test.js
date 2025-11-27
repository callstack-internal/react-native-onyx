/**
 * Performance Comparison Test
 * Compares KeyBased vs StoreBased vs ProxyBased vs ObserverBased implementations
 * Run with: npx tsx prototypes/perf-test.js
 */

const {performance} = require('perf_hooks');

// Helper to measure performance
async function measure(name, fn, runs = 5) {
    const times = [];

    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        await fn();
        const end = performance.now();
        times.push(end - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    return {
        name,
        avg: Math.round(avg * 100) / 100,
        min: Math.round(min * 100) / 100,
        max: Math.round(max * 100) / 100,
        runs,
    };
}

// Test 1: Multiple subscriptions to same key
async function test1_multipleSubscriptionsSameKey(Onyx, count = 100) {
    await Onyx.init({maxCachedKeysCount: 1000});
    await Onyx.set('shared_key', {value: 0});

    return await measure(`Subscribe ${count} listeners to same key`, async () => {
        const connections = [];
        for (let i = 0; i < count; i++) {
            const conn = Onyx.connect({
                key: 'shared_key',
                callback: () => {},
            });
            connections.push(conn);
        }

        // Update the key once
        await Onyx.set('shared_key', {value: 1});

        // Disconnect all
        connections.forEach((conn) => Onyx.disconnect(conn));
    });
}

// Test 2: Subscriptions to different keys
async function test2_subscriptionsDifferentKeys(Onyx, count = 100) {
    await Onyx.init({maxCachedKeysCount: 1000});

    return await measure(`Subscribe to ${count} different keys`, async () => {
        const connections = [];
        for (let i = 0; i < count; i++) {
            await Onyx.set(`key_${i}`, {value: i});
            const conn = Onyx.connect({
                key: `key_${i}`,
                callback: () => {},
            });
            connections.push(conn);
        }

        // Disconnect all
        connections.forEach((conn) => Onyx.disconnect(conn));
        await Onyx.clear();
    });
}

// Test 3: Individual collection writes
async function test3_individualCollectionWrites(Onyx, count = 100) {
    await Onyx.init({maxCachedKeysCount: 1000});

    return await measure(`Set ${count} collection items individually`, async () => {
        for (let i = 0; i < count; i++) {
            await Onyx.set(`report_${String(i).padStart(3, '0')}`, {
                id: i,
                title: `Report ${i}`,
                description: `Description for report ${i}`,
                data: new Array(10).fill(i),
            });
        }
        await Onyx.clear();
    });
}

// Test 4: Bulk collection write
async function test4_bulkCollectionWrite(Onyx, count = 100) {
    await Onyx.init({maxCachedKeysCount: 1000});

    return await measure(`Merge ${count} collection items in bulk`, async () => {
        const collection = {};
        for (let i = 0; i < count; i++) {
            collection[`report_${String(i).padStart(3, '0')}`] = {
                id: i,
                title: `Report ${i}`,
                description: `Description for report ${i}`,
                data: new Array(10).fill(i),
            };
        }
        await Onyx.mergeCollection('report_', collection);
        await Onyx.clear();
    });
}

// Test 5: Reads with cache
async function test5_readsWithCache(Onyx, count = 100) {
    await Onyx.init({maxCachedKeysCount: 1000});

    // Setup: Create keys
    for (let i = 0; i < count; i++) {
        await Onyx.set(`key_${i}`, {value: i, data: new Array(10).fill(i)});
    }

    const result = await measure(`Read ${count} keys (with cache)`, async () => {
        for (let i = 0; i < count; i++) {
            await Onyx.get(`key_${i}`);
        }
    });

    await Onyx.clear();
    return result;
}

// Test 6: Updates with subscribers
async function test6_updatesWithSubscribers(Onyx, subscriberCount = 50, updateCount = 100) {
    await Onyx.init({maxCachedKeysCount: 1000});

    // Setup subscribers
    const connections = [];
    for (let i = 0; i < subscriberCount; i++) {
        const conn = Onyx.connect({
            key: 'shared_key',
            callback: () => {},
        });
        connections.push(conn);
    }

    const result = await measure(`${updateCount} updates with ${subscriberCount} subscribers`, async () => {
        for (let i = 0; i < updateCount; i++) {
            await Onyx.set('shared_key', {value: i});
        }
    });

    // Cleanup
    connections.forEach((conn) => Onyx.disconnect(conn));
    await Onyx.clear();

    return result;
}

// Run all tests for one implementation
async function runAllTests(name, Onyx) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing: ${name}`);
    console.log('='.repeat(70));

    const results = [];

    try {
        console.log('\n🔄 Test 1: Multiple subscriptions to same key...');
        results.push(await test1_multipleSubscriptionsSameKey(Onyx, 100));
        await Onyx.clear();

        console.log('🔄 Test 2: Subscriptions to different keys...');
        results.push(await test2_subscriptionsDifferentKeys(Onyx, 100));
        await Onyx.clear();

        console.log('🔄 Test 3: Individual collection writes...');
        results.push(await test3_individualCollectionWrites(Onyx, 100));
        await Onyx.clear();

        console.log('🔄 Test 4: Bulk collection write...');
        results.push(await test4_bulkCollectionWrite(Onyx, 100));
        await Onyx.clear();

        console.log('🔄 Test 5: Reads with cache...');
        results.push(await test5_readsWithCache(Onyx, 100));
        await Onyx.clear();

        console.log('🔄 Test 6: Updates with subscribers...');
        results.push(await test6_updatesWithSubscribers(Onyx, 50, 100));
        await Onyx.clear();

        console.log('✅ All tests completed!');
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        throw error;
    }

    return results;
}

// Print results table
function printResults(keyBasedResults, storeBasedResults, proxyBasedResults, observerBasedResults) {
    console.log('\n\n' + '='.repeat(140));
    console.log('📊 PERFORMANCE COMPARISON RESULTS');
    console.log('='.repeat(140));

    console.log('\n┌────────────────────────────────────────────────────┬───────────────┬───────────────┬───────────────┬───────────────┬──────────────┐');
    console.log('│ Test                                               │   KeyBased    │  StoreBased   │  ProxyBased   │ ObserverBased │    Winner    │');
    console.log('├────────────────────────────────────────────────────┼───────────────┼───────────────┼───────────────┼───────────────┼──────────────┤');

    let kbWins = 0;
    let sbWins = 0;
    let pbWins = 0;
    let obWins = 0;

    keyBasedResults.forEach((kbResult, i) => {
        const sbResult = storeBasedResults[i];
        const pbResult = proxyBasedResults[i];
        const obResult = observerBasedResults[i];
        const kbAvg = kbResult.avg;
        const sbAvg = sbResult.avg;
        const pbAvg = pbResult.avg;
        const obAvg = obResult.avg;

        const minAvg = Math.min(kbAvg, sbAvg, pbAvg, obAvg);
        let winner = '   Tie   ';
        let winnerEmoji = '🤝';

        // Determine winner (must be at least 5% faster to avoid ties due to noise)
        if (kbAvg === minAvg && kbAvg < sbAvg * 0.95 && kbAvg < pbAvg * 0.95 && kbAvg < obAvg * 0.95) {
            winner = ' KeyBased ';
            winnerEmoji = '🔵';
            kbWins++;
        } else if (sbAvg === minAvg && sbAvg < kbAvg * 0.95 && sbAvg < pbAvg * 0.95 && sbAvg < obAvg * 0.95) {
            winner = 'StoreBased';
            winnerEmoji = '🟢';
            sbWins++;
        } else if (pbAvg === minAvg && pbAvg < kbAvg * 0.95 && pbAvg < sbAvg * 0.95 && pbAvg < obAvg * 0.95) {
            winner = 'ProxyBased';
            winnerEmoji = '🟣';
            pbWins++;
        } else if (obAvg === minAvg && obAvg < kbAvg * 0.95 && obAvg < sbAvg * 0.95 && obAvg < pbAvg * 0.95) {
            winner = 'ObserverBased';
            winnerEmoji = '🟡';
            obWins++;
        }

        console.log(
            `│ ${kbResult.name.padEnd(50)} │ ${(kbAvg + 'ms').padStart(13)} │ ${(sbAvg + 'ms').padStart(13)} │ ${(pbAvg + 'ms').padStart(13)} │ ${(obAvg + 'ms').padStart(
                13,
            )} │ ${winnerEmoji} ${winner} │`,
        );
    });

    console.log('└────────────────────────────────────────────────────┴───────────────┴───────────────┴───────────────┴───────────────┴──────────────┘');

    console.log(`\n\n📈 Summary: KeyBased won ${kbWins} tests, StoreBased won ${sbWins} tests, ProxyBased won ${pbWins} tests, ObserverBased won ${obWins} tests\n`);

    // Key insights
    console.log('💡 Key Insights:\n');

    keyBasedResults.forEach((kbResult, i) => {
        const sbResult = storeBasedResults[i];
        const pbResult = proxyBasedResults[i];
        const obResult = observerBasedResults[i];
        const results = [
            {name: 'KeyBased', avg: kbResult.avg},
            {name: 'StoreBased', avg: sbResult.avg},
            {name: 'ProxyBased', avg: pbResult.avg},
            {name: 'ObserverBased', avg: obResult.avg},
        ];

        results.sort((a, b) => a.avg - b.avg);
        const fastest = results[0];
        const slowest = results[3];
        const diff = slowest.avg - fastest.avg;
        const pct = ((diff / fastest.avg) * 100).toFixed(1);

        if (pct > 20) {
            console.log(`  • ${kbResult.name}:`);
            console.log(`    ${fastest.name} is ${pct}% faster than ${slowest.name} (${diff.toFixed(2)}ms difference)`);
        }
    });

    console.log('\n');
}

// Main execution
async function main() {
    console.log('🚀 Starting Performance Comparison\n');
    console.log('Note: This is a simple test. Results may vary based on system load.\n');

    // Dynamic imports to avoid conflicts
    let KeyBasedOnyx, StoreBasedOnyx, ProxyBasedOnyx, ObserverBasedOnyx;

    try {
        KeyBasedOnyx = require('./KeyBased/Onyx.ts').default;
        console.log('✅ Loaded KeyBased Onyx');
    } catch (e) {
        console.error('❌ Failed to load KeyBased Onyx:', e.message);
        console.log('\n💡 Try running: npx tsx prototypes/perf-test.js\n');
        process.exit(1);
    }

    try {
        StoreBasedOnyx = require('./StoreBased/Onyx.ts').default;
        console.log('✅ Loaded StoreBased Onyx');
    } catch (e) {
        console.error('❌ Failed to load StoreBased Onyx:', e.message);
        process.exit(1);
    }

    try {
        ProxyBasedOnyx = require('./ProxyBased/Onyx.ts').default;
        console.log('✅ Loaded ProxyBased Onyx');
    } catch (e) {
        console.error('❌ Failed to load ProxyBased Onyx:', e.message);
        process.exit(1);
    }

    try {
        ObserverBasedOnyx = require('./ObserverBased/Onyx.ts').default;
        console.log('✅ Loaded ObserverBased Onyx');
    } catch (e) {
        console.error('❌ Failed to load ObserverBased Onyx:', e.message);
        process.exit(1);
    }

    try {
        const keyBasedResults = await runAllTests('KeyBased', KeyBasedOnyx);
        const storeBasedResults = await runAllTests('StoreBased', StoreBasedOnyx);
        const proxyBasedResults = await runAllTests('ProxyBased', ProxyBasedOnyx);
        const observerBasedResults = await runAllTests('ObserverBased', ObserverBasedOnyx);

        printResults(keyBasedResults, storeBasedResults, proxyBasedResults, observerBasedResults);

        console.log('✅ All performance tests completed successfully!\n');
    } catch (error) {
        console.error('\n❌ Performance test failed:', error);
        process.exit(1);
    }
}

// Run it
if (require.main === module) {
    main();
}

module.exports = {measure, runAllTests};

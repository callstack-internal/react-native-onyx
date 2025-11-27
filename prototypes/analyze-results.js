#!/usr/bin/env node

/**
 * Analysis Script for Prototype Performance Comparison
 * Reads Reassure performance results and generates comparison reports
 */

const fs = require('fs');
const path = require('path');

const PROTOTYPES = ['KeyBased', 'StoreBased', 'ProxyBased', 'ObserverBased'];
const COMPARISON_DIR = path.join(__dirname, '..', '.reassure', 'comparisons');
const OUTPUT_FILE = path.join(__dirname, 'PERFORMANCE_COMPARISON.md');

// Parse a .perf file
function parsePerfFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const results = {};

        // Parse the JSON lines format used by Reassure
        const lines = content.trim().split('\n');
        lines.forEach((line) => {
            if (!line.trim()) return;
            try {
                const entry = JSON.parse(line);
                // Extract test name without prototype prefix
                const testName = entry.name.replace(/^Prototype Comparison - \w+ /, '');
                results[testName] = {
                    duration: entry.meanDuration,
                    stdev: entry.stdevDuration,
                    count: entry.meanCount,
                };
            } catch (e) {
                // Skip invalid lines
            }
        });

        return results;
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        return null;
    }
}

// Load results for all prototypes
function loadResults() {
    const results = {};

    PROTOTYPES.forEach((prototype) => {
        const baselinePath = path.join(COMPARISON_DIR, `${prototype}_baseline.perf`);
        const currentPath = path.join(COMPARISON_DIR, `${prototype}_current.perf`);

        const baseline = parsePerfFile(baselinePath);
        const current = parsePerfFile(currentPath);

        if (baseline || current) {
            results[prototype] = {
                baseline: baseline || {},
                current: current || {},
            };
        }
    });

    return results;
}

// Calculate percentage difference
function percentDiff(baseline, current) {
    if (!baseline || baseline === 0) return 0;
    return ((current - baseline) / baseline) * 100;
}

// Format duration
function formatDuration(ms) {
    if (ms < 0.01) return '< 0.01 ms';
    if (ms < 1) return `${ms.toFixed(2)} ms`;
    if (ms < 100) return `${ms.toFixed(1)} ms`;
    return `${Math.round(ms)} ms`;
}

// Generate markdown report
function generateReport(results) {
    let report = '# Onyx Prototypes Performance Comparison\n\n';
    report += `*Generated: ${new Date().toISOString()}*\n\n`;
    report += '## Overview\n\n';
    report += 'This report compares the performance of 4 Onyx prototype implementations:\n\n';
    report +=
        '- **KeyBased**: Per-key subscriptions with individual storage\n- **StoreBased**: Global store with collection-based storage\n- **ProxyBased**: Proxy-based reactive system\n- **ObserverBased**: Observer pattern implementation\n\n';

    // Get all unique test names
    const allTestNames = new Set();
    Object.values(results).forEach((prototypeResults) => {
        Object.keys(prototypeResults.current || {}).forEach((name) => allTestNames.add(name));
    });

    if (allTestNames.size === 0) {
        report += '⚠️ No test results found. Please run the performance tests first.\n\n';
        return report;
    }

    const testCategories = {
        'Basic Operations': ['set -', 'merge -', 'get -', 'clear -'],
        'Collection Operations': ['mergeCollection -'],
        'Subscription Performance': ['subscribe -', 'notify -'],
        'Mixed Workload': ['realistic workload'],
        'Memory and Cache': ['cache thrashing'],
        'Large Objects': ['large object'],
    };

    // Generate comparison tables by category
    Object.entries(testCategories).forEach(([category, patterns]) => {
        const categoryTests = Array.from(allTestNames).filter((testName) => patterns.some((pattern) => testName.toLowerCase().includes(pattern.toLowerCase())));

        if (categoryTests.length === 0) return;

        report += `## ${category}\n\n`;
        report += '| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |\n';
        report += '|------|----------|------------|------------|---------------|--------|\n';

        categoryTests.forEach((testName) => {
            const durations = {};
            let hasData = false;

            PROTOTYPES.forEach((prototype) => {
                const data = results[prototype]?.current?.[testName];
                if (data) {
                    durations[prototype] = data.duration;
                    hasData = true;
                } else {
                    durations[prototype] = null;
                }
            });

            if (!hasData) return;

            // Find winner (lowest duration, must be at least 10% faster)
            const validDurations = Object.entries(durations).filter(([_, d]) => d !== null);
            const minDuration = Math.min(...validDurations.map(([_, d]) => d));
            let winner = 'Tie';

            validDurations.forEach(([prototype, duration]) => {
                if (duration === minDuration) {
                    // Check if it's significantly faster (at least 10%)
                    const otherDurations = validDurations.filter(([p]) => p !== prototype).map(([_, d]) => d);
                    const isSignificantlyFaster = otherDurations.every((d) => duration < d * 0.9);
                    if (isSignificantlyFaster || otherDurations.length === 0) {
                        winner = prototype;
                    }
                }
            });

            // Format row
            const cells = PROTOTYPES.map((prototype) => {
                const duration = durations[prototype];
                if (duration === null) return 'N/A';
                const formatted = formatDuration(duration);
                return winner === prototype ? `**${formatted}**` : formatted;
            });

            const winnerCell = winner === 'Tie' ? 'Tie 🤝' : `${winner} 🏆`;

            report += `| ${testName} | ${cells.join(' | ')} | ${winnerCell} |\n`;
        });

        report += '\n';
    });

    // Summary section
    report += '## Summary\n\n';

    const wins = {KeyBased: 0, StoreBased: 0, ProxyBased: 0, ObserverBased: 0};

    Array.from(allTestNames).forEach((testName) => {
        const durations = {};
        PROTOTYPES.forEach((prototype) => {
            const data = results[prototype]?.current?.[testName];
            if (data) durations[prototype] = data.duration;
        });

        const validDurations = Object.entries(durations).filter(([_, d]) => d !== null && d !== undefined);
        if (validDurations.length === 0) return;

        const minDuration = Math.min(...validDurations.map(([_, d]) => d));
        validDurations.forEach(([prototype, duration]) => {
            if (duration === minDuration) {
                const otherDurations = validDurations.filter(([p]) => p !== prototype).map(([_, d]) => d);
                const isSignificantlyFaster = otherDurations.every((d) => duration < d * 0.9);
                if (isSignificantlyFaster || otherDurations.length === 0) {
                    wins[prototype]++;
                }
            }
        });
    });

    report += '### Test Wins by Prototype\n\n';
    const sortedWins = Object.entries(wins).sort((a, b) => b[1] - a[1]);
    sortedWins.forEach(([prototype, count], index) => {
        const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        report += `${emoji} **${prototype}**: ${count} wins\n`;
    });

    report += '\n';

    // Key insights
    report += '## Key Insights\n\n';

    const overallWinner = sortedWins[0][0];
    report += `- **Overall Best Performance**: ${overallWinner} won the most tests (${sortedWins[0][1]} wins)\n`;

    // Find specific strengths
    const strengths = {
        KeyBased: [],
        StoreBased: [],
        ProxyBased: [],
        ObserverBased: [],
    };

    Array.from(allTestNames).forEach((testName) => {
        const durations = {};
        PROTOTYPES.forEach((prototype) => {
            const data = results[prototype]?.current?.[testName];
            if (data) durations[prototype] = data.duration;
        });

        const validDurations = Object.entries(durations).filter(([_, d]) => d !== null);
        if (validDurations.length < 2) return;

        const minDuration = Math.min(...validDurations.map(([_, d]) => d));
        const winner = validDurations.find(([_, d]) => d === minDuration)?.[0];

        if (winner) {
            const otherDurations = validDurations.filter(([p]) => p !== winner).map(([_, d]) => d);
            const avgOther = otherDurations.reduce((a, b) => a + b, 0) / otherDurations.length;
            const improvement = ((avgOther - minDuration) / minDuration) * 100;

            if (improvement > 20) {
                strengths[winner].push({testName, improvement: improvement.toFixed(0)});
            }
        }
    });

    Object.entries(strengths).forEach(([prototype, tests]) => {
        if (tests.length > 0) {
            report += `\n### ${prototype} Strengths\n\n`;
            tests.forEach(({testName, improvement}) => {
                report += `- **${testName}**: ${improvement}% faster than average\n`;
            });
        }
    });

    report += '\n## How to Read This Report\n\n';
    report +=
        '- **Winner**: The prototype with the fastest average duration for each test\n- A winner is only declared if it is at least 10% faster than others (otherwise marked as "Tie")\n- Duration values are mean execution times across multiple runs\n- Tests are run using Reassure for statistical significance\n\n';

    report += '## Running the Tests\n\n';
    report += '```bash\n';
    report += '# Run all prototypes comparison\n';
    report += 'npm run prototype-perf-compare\n\n';
    report += '# Or run individual prototype tests\n';
    report += 'PROTOTYPE=KeyBased npm run perf-test -- --testNamePattern="Prototype Comparison"\n';
    report += 'PROTOTYPE=StoreBased npm run perf-test -- --testNamePattern="Prototype Comparison"\n';
    report += '```\n';

    return report;
}

// Main execution
console.log('Analyzing performance results...\n');

const results = loadResults();

if (Object.keys(results).length === 0) {
    console.error('❌ No performance results found.');
    console.error('Please run: npm run prototype-perf-compare');
    process.exit(1);
}

const report = generateReport(results);

// Write report
fs.writeFileSync(OUTPUT_FILE, report);

console.log('✓ Analysis complete!');
console.log(`\nReport saved to: ${OUTPUT_FILE}\n`);

// Print summary to console
const lines = report.split('\n');
const summaryStart = lines.findIndex((l) => l.startsWith('## Summary'));
if (summaryStart > 0) {
    console.log(lines.slice(summaryStart, summaryStart + 10).join('\n'));
}

# Prototype Performance Testing Guide

This guide explains how to use the new Reassure-based performance testing system for comparing the 4 Onyx prototypes.

## Quick Start

### Run Full Comparison (Recommended)

This will test all 4 prototypes (KeyBased, StoreBased, ProxyBased, ObserverBased) and generate a comprehensive comparison report:

```bash
npm run prototype-perf-compare
```

This command will:
1. Run baseline tests for all 4 prototypes
2. Run current tests for all 4 prototypes
3. Generate comparison report at `prototypes/PERFORMANCE_COMPARISON.md`

**Time estimate:** ~10-15 minutes for all prototypes

### Test Individual Prototype

To test a specific prototype only:

```bash
# Test KeyBased prototype
PROTOTYPE=KeyBased npm run perf-test -- --testNamePattern="Prototype Comparison"

# Test StoreBased prototype
PROTOTYPE=StoreBased npm run perf-test -- --testNamePattern="Prototype Comparison"

# Test ProxyBased prototype
PROTOTYPE=ProxyBased npm run perf-test -- --testNamePattern="Prototype Comparison"

# Test ObserverBased prototype
PROTOTYPE=ObserverBased npm run perf-test -- --testNamePattern="Prototype Comparison"
```

### Run Only Baseline or Current

If you want to run only baseline or only current tests:

```bash
# Run baseline only (first run, or when you want to update baseline)
npm run prototype-perf-baseline

# Run current only (after making changes to compare against baseline)
npm run prototype-perf-current
```

## What Tests Are Included?

The performance test suite (`prototypes/prototypes.perf-test.ts`) includes:

### 1. Basic Operations
- **set**: 1000 individual key sets
- **merge**: 1000 individual key merges
- **get**: 1000 cached reads
- **clear**: Clear 1000 keys

### 2. Collection Operations
- **mergeCollection**: Bulk insert 1000 items
- **mergeCollection**: Update 500 of 1000 items

### 3. Subscription Performance
- **subscribe**: 100 subscribers to same key
- **subscribe**: 100 subscribers to different keys
- **notify**: Update key with 50 subscribers
- **notify**: Scattered updates with 100 total subscribers

### 4. Mixed Workload
- **realistic workload**: Combination of reads, writes, and subscriptions

### 5. Memory and Cache
- **cache thrashing**: Exceed cache size limits

### 6. Large Objects
- **large object**: Single 10KB object operations
- **large object**: Merge deeply nested objects

## Understanding the Results

### Generated Files

After running tests, you'll find:

1. **prototypes/PERFORMANCE_COMPARISON.md** - Main comparison report with:
   - Test results table by category
   - Winner for each test (🏆)
   - Summary of wins by prototype
   - Key insights and strengths
   - Performance improvements (%)

2. **.reassure/comparisons/** - Raw performance data:
   - `{Prototype}_baseline.perf` - Baseline test results
   - `{Prototype}_current.perf` - Current test results
   - Individual comparison files

3. **.reassure/output.md** - Detailed Reassure output with:
   - Duration statistics (mean, stdev)
   - Individual run results
   - Outlier detection

### Reading the Comparison Report

The comparison report shows:

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| set - 1000 individual key sets | 2.5 ms | **1.7 ms** | 3.2 ms | 2.8 ms | StoreBased 🏆 |

- **Bold values**: Winner for that test
- **Winner**: Declared only if 10%+ faster than others
- **Tie 🤝**: When no prototype is significantly faster

## Typical Workflow

### 1. Initial Baseline

First time running tests or when starting fresh:

```bash
# Run all prototypes and establish baseline
npm run prototype-perf-compare
```

### 2. Make Changes to a Prototype

After modifying a prototype implementation:

```bash
# Test only the changed prototype against baseline
PROTOTYPE=StoreBased npm run perf-test -- --testNamePattern="Prototype Comparison" --baseline
PROTOTYPE=StoreBased npm run perf-test -- --testNamePattern="Prototype Comparison"

# Check the results
cat .reassure/output.md
```

### 3. Full Re-comparison

After significant changes to multiple prototypes:

```bash
# Update all baselines
npm run prototype-perf-baseline

# Make your changes...

# Run current tests and compare
npm run prototype-perf-current

# Generate report
node prototypes/analyze-results.js
```

## Tips for Stable Results

1. **Close unnecessary applications** to reduce system noise
2. **Run multiple times** if results seem inconsistent
3. **Use baseline tests** to establish reference point
4. **Focus on trends** rather than absolute values
5. **Look for significant differences** (>10%) not tiny variations

## Interpreting Performance Differences

### Significant Improvements
- **> 50%**: Major performance improvement 🚀
- **20-50%**: Substantial improvement ⚡
- **10-20%**: Noticeable improvement ✓

### Insignificant Differences
- **< 10%**: Consider it similar performance (within noise margin)

## Example: Comparing Two Prototypes

To compare KeyBased vs StoreBased specifically:

```bash
# 1. Run KeyBased baseline
PROTOTYPE=KeyBased npm run perf-test -- --testNamePattern="Prototype Comparison" --baseline

# 2. Run StoreBased as "current"
PROTOTYPE=StoreBased npm run perf-test -- --testNamePattern="Prototype Comparison"

# 3. Check Reassure output
cat .reassure/output.md
```

## Customizing Tests

To add new tests or modify existing ones, edit:

```
prototypes/prototypes.perf-test.ts
```

Test structure:

```typescript
test('test name', async () => {
    await measureAsyncFunction(
        async () => {
            // Code to measure
        },
        {
            beforeEach: async () => {
                // Setup before each run
            },
            afterEach: async () => {
                // Cleanup after each run
            },
        }
    );
});
```

## Troubleshooting

### Tests Taking Too Long

Reduce test iterations in `prototypes.perf-test.ts`:
- Change `1000` to `100` for faster tests
- Reduces accuracy but speeds up iteration

### Inconsistent Results

- Close other applications
- Run baseline tests again
- Increase number of runs in Reassure config
- Look at standard deviation in results

### Script Permission Error

Make script executable:

```bash
chmod +x prototypes/compare-prototypes.sh
```

### Module Not Found Errors

Ensure jest config includes prototypes:

```javascript
// jest.config.js
roots: ['<rootDir>/lib', '<rootDir>/tests', '<rootDir>/prototypes']
```

## Advanced: CI/CD Integration

To run in CI:

```yaml
# .github/workflows/perf-test.yml
- name: Run prototype performance tests
  run: npm run prototype-perf-compare

- name: Upload results
  uses: actions/upload-artifact@v3
  with:
    name: perf-results
    path: |
      .reassure/
      prototypes/PERFORMANCE_COMPARISON.md
```

## Comparison with Old perf-test.js

| Feature | Old (perf-test.js) | New (Reassure) |
|---------|-------------------|----------------|
| Runs per test | 5 | 10+ with warmup |
| Statistical analysis | No | Yes (stdev, outliers) |
| Stability | Low | High |
| Baseline comparison | Manual | Built-in |
| Confidence intervals | No | Yes |
| Report format | Console only | Markdown + JSON |
| Time to complete | Fast | Thorough |

## Next Steps

1. ✅ Run initial comparison: `npm run prototype-perf-compare`
2. 📊 Review results: `prototypes/PERFORMANCE_COMPARISON.md`
3. 🔍 Identify performance bottlenecks
4. 🚀 Make optimizations
5. 🔄 Re-run tests to verify improvements

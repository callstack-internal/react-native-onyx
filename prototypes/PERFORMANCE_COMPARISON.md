# Onyx Prototypes Performance Comparison

*Generated: 2025-11-28T16:16:34.678Z*

## Overview

This report compares the performance of 4 Onyx prototype implementations:

- **KeyBased**: Per-key subscriptions with individual storage
- **StoreBased**: Global store with collection-based storage
- **ProxyBased**: Proxy-based reactive system
- **ObserverBased**: Observer pattern implementation

## Basic Operations

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Basic Operations set - 1000 individual key sets | 2.3 ms | **2.2 ms** | 2.8 ms | 3.8 ms | StoreBased 🏆 |
| Basic Operations merge - 1000 individual key merges | 4.8 ms | **2.1 ms** | 5.3 ms | 3.0 ms | StoreBased 🏆 |
| Basic Operations get - 1000 cached reads | 0.73 ms | **0.62 ms** | 1.3 ms | 0.76 ms | StoreBased 🏆 |
| Basic Operations clear - with 1000 keys | **0.33 ms** | 0.41 ms | 0.56 ms | 1.3 ms | KeyBased 🏆 |

## Collection Operations

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Collection Operations mergeCollection - bulk insert 1000 items | 4.8 ms | 1.3 ms | 5.2 ms | **0.61 ms** | ObserverBased 🏆 |
| Collection Operations mergeCollection - update 500 of 1000 items | 1.9 ms | 0.57 ms | 5.3 ms | **0.11 ms** | ObserverBased 🏆 |

## Subscription Performance

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Subscription Performance subscribe - 100 subscribers to same key | 0.14 ms | **0.06 ms** | 0.12 ms | 0.06 ms | StoreBased 🏆 |
| Subscription Performance subscribe - 100 subscribers to different keys | 0.20 ms | 0.07 ms | 0.19 ms | **0.07 ms** | ObserverBased 🏆 |
| Subscription Performance notify - update key with 50 subscribers | 0.72 ms | 0.94 ms | 1.6 ms | **0.63 ms** | ObserverBased 🏆 |
| Subscription Performance notify - scattered updates with 100 total subscribers | 0.04 ms | 0.19 ms | 0.22 ms | **0.03 ms** | ObserverBased 🏆 |

## useOnyx Hook Performance

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| useOnyx Hook Performance useOnyx - initial render with cached data | **0.14 ms** | 0.15 ms | 0.16 ms | 0.15 ms | KeyBased 🏆 |
| useOnyx Hook Performance useOnyx - initial render without cached data | 0.12 ms | **0.11 ms** | 0.12 ms | 0.11 ms | StoreBased 🏆 |
| useOnyx Hook Performance useOnyx - re-render on data update | 0.47 ms | 0.39 ms | **0.11 ms** | 0.40 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - with selector | 0.12 ms | **0.10 ms** | 0.11 ms | 0.12 ms | StoreBased 🏆 |
| useOnyx Hook Performance useOnyx - selector with data updates | 0.18 ms | 0.16 ms | **0.11 ms** | 0.16 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - multiple hooks in one component | 0.18 ms | 0.16 ms | 0.16 ms | **0.15 ms** | ObserverBased 🏆 |
| useOnyx Hook Performance useOnyx - multiple hooks with updates | 0.45 ms | 0.40 ms | **0.14 ms** | 0.41 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - collection member updates | 0.41 ms | 0.47 ms | **0.11 ms** | 0.37 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - stress test with 20 hooks | 2.0 ms | 1.5 ms | **0.17 ms** | 1.6 ms | ProxyBased 🏆 |

## Mixed Workload

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Mixed Workload realistic workload - reads, writes, and subscriptions | 0.19 ms | **0.15 ms** | 0.42 ms | 0.17 ms | StoreBased 🏆 |

## Memory and Cache

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Memory and Cache cache thrashing - exceed cache size | 13.9 ms | **6.0 ms** | 10.0 ms | 8.4 ms | StoreBased 🏆 |

## Large Objects

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Large Objects large object - single 10KB object | 0.27 ms | 0.28 ms | 0.28 ms | **0.24 ms** | ObserverBased 🏆 |
| Large Objects large object - merge deeply nested object | < 0.01 ms | **< 0.01 ms** | 0.01 ms | < 0.01 ms | StoreBased 🏆 |

## Summary

### Test Wins by Prototype

🥇 **StoreBased**: 9 wins
🥈 **ObserverBased**: 7 wins
🥉 **ProxyBased**: 5 wins
   **KeyBased**: 2 wins

## Key Insights

- **Overall Best Performance**: StoreBased won the most tests (9 wins)

### KeyBased Strengths

- **Basic Operations clear - with 1000 keys**: 133% faster than average

### StoreBased Strengths

- **Basic Operations set - 1000 individual key sets**: 38% faster than average
- **Basic Operations merge - 1000 individual key merges**: 109% faster than average
- **Basic Operations get - 1000 cached reads**: 52% faster than average
- **Subscription Performance subscribe - 100 subscribers to same key**: 86% faster than average
- **Mixed Workload realistic workload - reads, writes, and subscriptions**: 72% faster than average
- **Memory and Cache cache thrashing - exceed cache size**: 81% faster than average
- **Large Objects large object - merge deeply nested object**: 27% faster than average

### ProxyBased Strengths

- **useOnyx Hook Performance useOnyx - re-render on data update**: 272% faster than average
- **useOnyx Hook Performance useOnyx - selector with data updates**: 53% faster than average
- **useOnyx Hook Performance useOnyx - multiple hooks with updates**: 199% faster than average
- **useOnyx Hook Performance useOnyx - collection member updates**: 276% faster than average
- **useOnyx Hook Performance useOnyx - stress test with 20 hooks**: 921% faster than average

### ObserverBased Strengths

- **Collection Operations mergeCollection - bulk insert 1000 items**: 522% faster than average
- **Collection Operations mergeCollection - update 500 of 1000 items**: 2260% faster than average
- **Subscription Performance subscribe - 100 subscribers to different keys**: 124% faster than average
- **Subscription Performance notify - update key with 50 subscribers**: 74% faster than average
- **Subscription Performance notify - scattered updates with 100 total subscribers**: 409% faster than average

## How to Read This Report

- **Winner**: The prototype with the fastest average duration for each test
- A winner is only declared if it is faster than others (otherwise marked as "Tie")
- Duration values are mean execution times across multiple runs
- Tests are run using Reassure for statistical significance

## Running the Tests

```bash
# Run all prototypes comparison
npm run prototype-perf-compare

# Or run individual prototype tests
PROTOTYPE=KeyBased npm run perf-test -- --testNamePattern="Prototype Comparison"
PROTOTYPE=StoreBased npm run perf-test -- --testNamePattern="Prototype Comparison"
```

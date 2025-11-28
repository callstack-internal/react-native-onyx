# Onyx Prototypes Performance Comparison

*Generated: 2025-11-28T15:17:11.265Z*

## Overview

This report compares the performance of 4 Onyx prototype implementations:

- **KeyBased**: Per-key subscriptions with individual storage
- **StoreBased**: Global store with collection-based storage
- **ProxyBased**: Proxy-based reactive system
- **ObserverBased**: Observer pattern implementation

## Basic Operations

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Basic Operations set - 1000 individual key sets | 2.3 ms | 2.3 ms | 2.6 ms | **2.2 ms** | ObserverBased 🏆 |
| Basic Operations merge - 1000 individual key merges | 4.7 ms | **2.1 ms** | 4.7 ms | 4.0 ms | StoreBased 🏆 |
| Basic Operations get - 1000 cached reads | 0.70 ms | **0.65 ms** | 1.1 ms | 0.68 ms | StoreBased 🏆 |
| Basic Operations clear - with 1000 keys | **0.32 ms** | 0.43 ms | 0.53 ms | 0.40 ms | KeyBased 🏆 |

## Collection Operations

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Collection Operations mergeCollection - bulk insert 1000 items | 4.8 ms | **1.4 ms** | 4.9 ms | 2.0 ms | StoreBased 🏆 |
| Collection Operations mergeCollection - update 500 of 1000 items | 1.9 ms | **0.59 ms** | 5.5 ms | 0.64 ms | StoreBased 🏆 |

## Subscription Performance

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Subscription Performance subscribe - 100 subscribers to same key | 0.14 ms | **0.06 ms** | 0.11 ms | 0.10 ms | StoreBased 🏆 |
| Subscription Performance subscribe - 100 subscribers to different keys | 0.20 ms | **0.06 ms** | 0.16 ms | 0.11 ms | StoreBased 🏆 |
| Subscription Performance notify - update key with 50 subscribers | **0.70 ms** | 0.99 ms | 1.3 ms | 0.73 ms | KeyBased 🏆 |
| Subscription Performance notify - scattered updates with 100 total subscribers | 0.04 ms | 0.20 ms | 0.18 ms | **0.03 ms** | ObserverBased 🏆 |

## useOnyx Hook Performance

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| useOnyx Hook Performance useOnyx - initial render with cached data | 0.15 ms | 0.14 ms | 0.15 ms | **0.14 ms** | ObserverBased 🏆 |
| useOnyx Hook Performance useOnyx - initial render without cached data | 0.11 ms | **0.10 ms** | 0.11 ms | 0.11 ms | StoreBased 🏆 |
| useOnyx Hook Performance useOnyx - re-render on data update | 0.44 ms | 0.39 ms | **0.11 ms** | 0.43 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - with selector | 0.13 ms | **0.11 ms** | 0.11 ms | 0.11 ms | StoreBased 🏆 |
| useOnyx Hook Performance useOnyx - selector with data updates | 0.18 ms | 0.16 ms | **0.10 ms** | 0.19 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - multiple hooks in one component | 0.16 ms | 0.16 ms | **0.14 ms** | 0.15 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - multiple hooks with updates | 0.41 ms | 0.40 ms | **0.14 ms** | 0.43 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - collection member updates | 0.39 ms | 0.37 ms | **0.11 ms** | 0.40 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - stress test with 20 hooks | 1.8 ms | 1.5 ms | **0.14 ms** | 1.5 ms | ProxyBased 🏆 |

## Mixed Workload

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Mixed Workload realistic workload - reads, writes, and subscriptions | 0.18 ms | 0.16 ms | 0.37 ms | **0.14 ms** | ObserverBased 🏆 |

## Memory and Cache

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Memory and Cache cache thrashing - exceed cache size | 14.0 ms | **5.8 ms** | 9.1 ms | 6.1 ms | StoreBased 🏆 |

## Large Objects

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Large Objects large object - single 10KB object | 0.27 ms | **0.25 ms** | 0.28 ms | 0.28 ms | StoreBased 🏆 |
| Large Objects large object - merge deeply nested object | < 0.01 ms | **< 0.01 ms** | 0.01 ms | < 0.01 ms | StoreBased 🏆 |

## Summary

### Test Wins by Prototype

🥇 **StoreBased**: 11 wins
🥈 **ProxyBased**: 6 wins
🥉 **ObserverBased**: 4 wins
   **KeyBased**: 2 wins

## Key Insights

- **Overall Best Performance**: StoreBased won the most tests (11 wins)

### KeyBased Strengths

- **Basic Operations clear - with 1000 keys**: 40% faster than average
- **Subscription Performance notify - update key with 50 subscribers**: 46% faster than average

### StoreBased Strengths

- **Basic Operations merge - 1000 individual key merges**: 115% faster than average
- **Basic Operations get - 1000 cached reads**: 29% faster than average
- **Collection Operations mergeCollection - bulk insert 1000 items**: 172% faster than average
- **Collection Operations mergeCollection - update 500 of 1000 items**: 355% faster than average
- **Subscription Performance subscribe - 100 subscribers to same key**: 91% faster than average
- **Subscription Performance subscribe - 100 subscribers to different keys**: 139% faster than average
- **Memory and Cache cache thrashing - exceed cache size**: 69% faster than average
- **Large Objects large object - merge deeply nested object**: 53% faster than average

### ProxyBased Strengths

- **useOnyx Hook Performance useOnyx - re-render on data update**: 294% faster than average
- **useOnyx Hook Performance useOnyx - selector with data updates**: 69% faster than average
- **useOnyx Hook Performance useOnyx - multiple hooks with updates**: 206% faster than average
- **useOnyx Hook Performance useOnyx - collection member updates**: 257% faster than average
- **useOnyx Hook Performance useOnyx - stress test with 20 hooks**: 1013% faster than average

### ObserverBased Strengths

- **Subscription Performance notify - scattered updates with 100 total subscribers**: 412% faster than average
- **Mixed Workload realistic workload - reads, writes, and subscriptions**: 65% faster than average

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

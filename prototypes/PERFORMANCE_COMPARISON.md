# Onyx Prototypes Performance Comparison

*Generated: 2025-11-28T16:19:21.132Z*

## Overview

This report compares the performance of 4 Onyx prototype implementations:

- **KeyBased**: Per-key subscriptions with individual storage
- **StoreBased**: Global store with collection-based storage
- **ProxyBased**: Proxy-based reactive system
- **ObserverBased**: Observer pattern implementation

## Basic Operations

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Basic Operations set - 1000 individual key sets | 2.3 ms | **2.1 ms** | 2.9 ms | 3.7 ms | StoreBased 🏆 |
| Basic Operations merge - 1000 individual key merges | 4.6 ms | **2.4 ms** | 4.7 ms | 3.4 ms | StoreBased 🏆 |
| Basic Operations get - 1000 cached reads | 0.73 ms | **0.57 ms** | 1.2 ms | 0.73 ms | StoreBased 🏆 |
| Basic Operations clear - with 1000 keys | **0.36 ms** | 0.43 ms | 0.50 ms | 1.3 ms | KeyBased 🏆 |

## Collection Operations

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Collection Operations mergeCollection - bulk insert 1000 items | 5.2 ms | 1.2 ms | 4.8 ms | **0.64 ms** | ObserverBased 🏆 |
| Collection Operations mergeCollection - update 500 of 1000 items | 2.0 ms | 0.55 ms | 5.3 ms | **0.12 ms** | ObserverBased 🏆 |

## Subscription Performance

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Subscription Performance subscribe - 100 subscribers to same key | 0.13 ms | **0.05 ms** | 0.13 ms | 0.07 ms | StoreBased 🏆 |
| Subscription Performance subscribe - 100 subscribers to different keys | 0.20 ms | **0.05 ms** | 0.21 ms | 0.06 ms | StoreBased 🏆 |
| Subscription Performance notify - update key with 50 subscribers | 0.71 ms | 0.75 ms | 1.3 ms | **0.66 ms** | ObserverBased 🏆 |
| Subscription Performance notify - scattered updates with 100 total subscribers | 0.04 ms | 0.15 ms | 0.18 ms | **0.03 ms** | ObserverBased 🏆 |

## useOnyx Hook Performance

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| useOnyx Hook Performance useOnyx - initial render with cached data | 0.15 ms | 0.15 ms | 0.15 ms | **0.14 ms** | ObserverBased 🏆 |
| useOnyx Hook Performance useOnyx - initial render without cached data | 0.11 ms | 0.11 ms | 0.12 ms | **0.11 ms** | ObserverBased 🏆 |
| useOnyx Hook Performance useOnyx - re-render on data update | 0.39 ms | 0.34 ms | **0.11 ms** | 0.39 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - with selector | 0.11 ms | **0.10 ms** | 0.13 ms | 0.12 ms | StoreBased 🏆 |
| useOnyx Hook Performance useOnyx - selector with data updates | 0.20 ms | 0.15 ms | **0.11 ms** | 0.15 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - multiple hooks in one component | 0.17 ms | 0.16 ms | 0.16 ms | **0.15 ms** | ObserverBased 🏆 |
| useOnyx Hook Performance useOnyx - multiple hooks with updates | 0.50 ms | 0.45 ms | **0.15 ms** | 0.42 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - collection member updates | 0.43 ms | 0.35 ms | **0.10 ms** | 0.35 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - stress test with 20 hooks | 2.0 ms | 1.0 ms | **0.14 ms** | 1.7 ms | ProxyBased 🏆 |

## Mixed Workload

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Mixed Workload realistic workload - reads, writes, and subscriptions | 0.19 ms | **0.13 ms** | 0.43 ms | 0.16 ms | StoreBased 🏆 |

## Memory and Cache

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Memory and Cache cache thrashing - exceed cache size | 14.2 ms | **5.1 ms** | 8.8 ms | 8.3 ms | StoreBased 🏆 |

## Large Objects

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Large Objects large object - single 10KB object | 0.26 ms | 0.26 ms | 0.27 ms | **0.24 ms** | ObserverBased 🏆 |
| Large Objects large object - merge deeply nested object | < 0.01 ms | **< 0.01 ms** | < 0.01 ms | < 0.01 ms | StoreBased 🏆 |

## Summary

### Test Wins by Prototype

🥇 **StoreBased**: 9 wins
🥈 **ObserverBased**: 8 wins
🥉 **ProxyBased**: 5 wins
   **KeyBased**: 1 wins

## Key Insights

- **Overall Best Performance**: StoreBased won the most tests (9 wins)

### KeyBased Strengths

- **Basic Operations clear - with 1000 keys**: 114% faster than average

### StoreBased Strengths

- **Basic Operations set - 1000 individual key sets**: 43% faster than average
- **Basic Operations merge - 1000 individual key merges**: 80% faster than average
- **Basic Operations get - 1000 cached reads**: 54% faster than average
- **Subscription Performance subscribe - 100 subscribers to same key**: 133% faster than average
- **Subscription Performance subscribe - 100 subscribers to different keys**: 194% faster than average
- **Mixed Workload realistic workload - reads, writes, and subscriptions**: 98% faster than average
- **Memory and Cache cache thrashing - exceed cache size**: 106% faster than average
- **Large Objects large object - merge deeply nested object**: 65% faster than average

### ProxyBased Strengths

- **useOnyx Hook Performance useOnyx - re-render on data update**: 244% faster than average
- **useOnyx Hook Performance useOnyx - selector with data updates**: 46% faster than average
- **useOnyx Hook Performance useOnyx - multiple hooks with updates**: 213% faster than average
- **useOnyx Hook Performance useOnyx - collection member updates**: 260% faster than average
- **useOnyx Hook Performance useOnyx - stress test with 20 hooks**: 1035% faster than average

### ObserverBased Strengths

- **Collection Operations mergeCollection - bulk insert 1000 items**: 478% faster than average
- **Collection Operations mergeCollection - update 500 of 1000 items**: 2084% faster than average
- **Subscription Performance notify - update key with 50 subscribers**: 42% faster than average
- **Subscription Performance notify - scattered updates with 100 total subscribers**: 298% faster than average

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

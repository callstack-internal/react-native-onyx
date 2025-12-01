# Onyx Prototypes Performance Comparison

*Generated: 2025-12-01T15:43:42.108Z*

## Overview

This report compares the performance of 3 Onyx prototype implementations:

- **KeyBased**: Per-key subscriptions with individual storage
- **StoreBased**: Global store with collection-based storage
- **ObserverBased**: Observer pattern implementation

*Note: ProxyBased prototype is temporarily excluded from this comparison.*

## Basic Operations

| Test | KeyBased | StoreBased | ObserverBased | Winner |
|------|----------|------------|---------------|--------|
| Basic Operations set - 1000 individual key sets | 2.6 ms | **2.1 ms** | 16.0 ms | StoreBased 🏆 |
| Basic Operations merge - 1000 individual key merges | 5.0 ms | **2.1 ms** | 16.1 ms | StoreBased 🏆 |
| Basic Operations get - 1000 cached reads | 0.70 ms | **0.56 ms** | 0.74 ms | StoreBased 🏆 |
| Basic Operations clear - with 1000 keys | **0.31 ms** | 0.36 ms | 1.3 ms | KeyBased 🏆 |

## Collection Operations

| Test | KeyBased | StoreBased | ObserverBased | Winner |
|------|----------|------------|---------------|--------|
| Collection Operations mergeCollection - bulk insert 1000 items | 5.1 ms | 1.3 ms | **0.60 ms** | ObserverBased 🏆 |
| Collection Operations mergeCollection - update 500 of 1000 items | 2.0 ms | 0.55 ms | **0.12 ms** | ObserverBased 🏆 |

## Subscription Performance

| Test | KeyBased | StoreBased | ObserverBased | Winner |
|------|----------|------------|---------------|--------|
| Subscription Performance subscribe - 100 subscribers to same key | 0.14 ms | **0.05 ms** | 0.06 ms | StoreBased 🏆 |
| Subscription Performance subscribe - 100 subscribers to different keys | 0.21 ms | 0.06 ms | **0.05 ms** | ObserverBased 🏆 |
| Subscription Performance notify - update key with 50 subscribers | 0.71 ms | 0.80 ms | **0.56 ms** | ObserverBased 🏆 |
| Subscription Performance notify - scattered updates with 100 total subscribers | 0.04 ms | 0.16 ms | **0.03 ms** | ObserverBased 🏆 |

## useOnyx Hook Performance

| Test | KeyBased | StoreBased | ObserverBased | Winner |
|------|----------|------------|---------------|--------|
| useOnyx Hook Performance useOnyx - initial render with cached data | 0.21 ms | 0.22 ms | 0.19 ms | Tie 🤝 |
| useOnyx Hook Performance useOnyx - initial render without cached data | 0.17 ms | 0.20 ms | 0.16 ms | Tie 🤝 |
| useOnyx Hook Performance useOnyx - re-render on data update | 0.43 ms | 0.41 ms | 0.37 ms | Tie 🤝 |
| useOnyx Hook Performance useOnyx - with selector | 0.12 ms | 0.12 ms | **0.11 ms** | ObserverBased 🏆 |
| useOnyx Hook Performance useOnyx - selector with data updates | 0.18 ms | 0.18 ms | **0.14 ms** | ObserverBased 🏆 |
| useOnyx Hook Performance useOnyx - multiple hooks in one component | 0.22 ms | 0.22 ms | 0.20 ms | Tie 🤝 |
| useOnyx Hook Performance useOnyx - multiple hooks with updates | 0.50 ms | 0.45 ms | 0.43 ms | Tie 🤝 |
| useOnyx Hook Performance useOnyx - collection member updates | 0.39 ms | 0.39 ms | **0.34 ms** | ObserverBased 🏆 |
| useOnyx Hook Performance useOnyx - stress test with 20 hooks | 2.5 ms | 1.2 ms | 1.2 ms | Tie 🤝 |
| Collection Subscription Performance useOnyx - subscribe to whole collection (100 items) | 0.19 ms | 0.15 ms | 0.14 ms | Tie 🤝 |
| Collection Subscription Performance useOnyx - subscribe to whole collection (500 items) | 0.34 ms | 0.20 ms | **0.11 ms** | ObserverBased 🏆 |
| Collection Subscription Performance useOnyx - subscribe to whole collection (1000 items) | 0.56 ms | 0.29 ms | **0.11 ms** | ObserverBased 🏆 |
| Collection Subscription Performance useOnyx - collection updates with subscriber (update 10 of 100 items) | 0.86 ms | 0.40 ms | 0.42 ms | Tie 🤝 |
| Collection Subscription Performance useOnyx - collection updates with subscriber (update 50 of 500 items) | 10.8 ms | **1.7 ms** | 2.4 ms | StoreBased 🏆 |
| Collection Subscription Performance useOnyx - add items to subscribed collection (add 20 to 100) | 1.6 ms | **0.66 ms** | 1.3 ms | StoreBased 🏆 |
| Collection Subscription Performance useOnyx - bulk collection merge with subscriber (merge 100 items) | 0.28 ms | 0.19 ms | 0.18 ms | Tie 🤝 |
| Collection Subscription Performance useOnyx - multiple components subscribed to same collection | 5.6 ms | **1.3 ms** | 3.2 ms | StoreBased 🏆 |

## Mixed Workload

| Test | KeyBased | StoreBased | ObserverBased | Winner |
|------|----------|------------|---------------|--------|
| Mixed Workload realistic workload - reads, writes, and subscriptions | 0.20 ms | **0.14 ms** | 0.21 ms | StoreBased 🏆 |

## Memory and Cache

| Test | KeyBased | StoreBased | ObserverBased | Winner |
|------|----------|------------|---------------|--------|
| Memory and Cache cache thrashing - exceed cache size | 16.2 ms | **5.5 ms** | 60.1 ms | StoreBased 🏆 |

## Large Objects

| Test | KeyBased | StoreBased | ObserverBased | Winner |
|------|----------|------------|---------------|--------|
| Large Objects large object - single 10KB object | 0.27 ms | 0.29 ms | 0.26 ms | Tie 🤝 |
| Large Objects large object - merge deeply nested object | < 0.01 ms | < 0.01 ms | < 0.01 ms | Tie 🤝 |

## Summary

### Test Wins by Prototype

🥇 **ObserverBased**: 10 wins
🥈 **StoreBased**: 9 wins
🥉 **KeyBased**: 1 wins

## Key Insights

- **Overall Best Performance**: ObserverBased won the most tests (10 wins)

### KeyBased Strengths

- **Basic Operations clear - with 1000 keys**: 166% faster than average

### StoreBased Strengths

- **Basic Operations set - 1000 individual key sets**: 335% faster than average
- **Basic Operations merge - 1000 individual key merges**: 408% faster than average
- **Basic Operations get - 1000 cached reads**: 29% faster than average
- **Subscription Performance subscribe - 100 subscribers to same key**: 110% faster than average
- **Mixed Workload realistic workload - reads, writes, and subscriptions**: 48% faster than average
- **Memory and Cache cache thrashing - exceed cache size**: 599% faster than average
- **useOnyx Hook Performance useOnyx - stress test with 20 hooks**: 61% faster than average
- **Collection Subscription Performance useOnyx - collection updates with subscriber (update 10 of 100 items)**: 62% faster than average
- **Collection Subscription Performance useOnyx - collection updates with subscriber (update 50 of 500 items)**: 299% faster than average
- **Collection Subscription Performance useOnyx - add items to subscribed collection (add 20 to 100)**: 118% faster than average
- **Collection Subscription Performance useOnyx - multiple components subscribed to same collection**: 238% faster than average

### ObserverBased Strengths

- **Collection Operations mergeCollection - bulk insert 1000 items**: 438% faster than average
- **Collection Operations mergeCollection - update 500 of 1000 items**: 982% faster than average
- **Subscription Performance subscribe - 100 subscribers to different keys**: 169% faster than average
- **Subscription Performance notify - update key with 50 subscribers**: 36% faster than average
- **Subscription Performance notify - scattered updates with 100 total subscribers**: 264% faster than average
- **useOnyx Hook Performance useOnyx - selector with data updates**: 28% faster than average
- **Collection Subscription Performance useOnyx - subscribe to whole collection (100 items)**: 24% faster than average
- **Collection Subscription Performance useOnyx - subscribe to whole collection (500 items)**: 145% faster than average
- **Collection Subscription Performance useOnyx - subscribe to whole collection (1000 items)**: 273% faster than average
- **Collection Subscription Performance useOnyx - bulk collection merge with subscriber (merge 100 items)**: 26% faster than average

## How to Read This Report

- **Winner**: The prototype with the fastest average duration for each test
- A winner is only declared if it is at least 10% faster than the second fastest (otherwise marked as "Tie")
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

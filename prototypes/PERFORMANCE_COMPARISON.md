# Onyx Prototypes Performance Comparison

*Generated: 2025-11-28T14:25:08.143Z*

## Overview

This report compares the performance of 4 Onyx prototype implementations:

- **KeyBased**: Per-key subscriptions with individual storage
- **StoreBased**: Global store with collection-based storage
- **ProxyBased**: Proxy-based reactive system
- **ObserverBased**: Observer pattern implementation

## Basic Operations

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Basic Operations set - 1000 individual key sets | 2.3 ms | 2.5 ms | 2.7 ms | 2.2 ms | Tie 🤝 |
| Basic Operations merge - 1000 individual key merges | 4.7 ms | **2.3 ms** | 5.1 ms | 4.1 ms | StoreBased 🏆 |
| Basic Operations get - 1000 cached reads | 0.71 ms | 0.67 ms | 1.2 ms | 0.65 ms | Tie 🤝 |
| Basic Operations clear - with 1000 keys | **0.18 ms** | 0.39 ms | 0.54 ms | 0.36 ms | KeyBased 🏆 |

## Collection Operations

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Collection Operations mergeCollection - bulk insert 1000 items | 4.7 ms | **1.4 ms** | 5.3 ms | 2.0 ms | StoreBased 🏆 |
| Collection Operations mergeCollection - update 500 of 1000 items | 1.8 ms | **0.58 ms** | 5.2 ms | 0.69 ms | StoreBased 🏆 |

## Subscription Performance

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Subscription Performance subscribe - 100 subscribers to same key | 0.12 ms | **0.06 ms** | 0.11 ms | 0.12 ms | StoreBased 🏆 |
| Subscription Performance subscribe - 100 subscribers to different keys | 0.19 ms | **0.06 ms** | 0.18 ms | 0.10 ms | StoreBased 🏆 |
| Subscription Performance notify - update key with 50 subscribers | 0.72 ms | 0.94 ms | 1.6 ms | 0.74 ms | Tie 🤝 |
| Subscription Performance notify - scattered updates with 100 total subscribers | 0.04 ms | 0.18 ms | 0.22 ms | **0.03 ms** | ObserverBased 🏆 |

## useOnyx Hook Performance

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| useOnyx Hook Performance useOnyx - initial render with cached data | 0.14 ms | 0.15 ms | 0.14 ms | 0.15 ms | Tie 🤝 |
| useOnyx Hook Performance useOnyx - initial render without cached data | 0.11 ms | 0.10 ms | 0.12 ms | 0.11 ms | Tie 🤝 |
| useOnyx Hook Performance useOnyx - re-render on data update | 0.39 ms | 0.38 ms | **0.11 ms** | 0.42 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - with selector | 0.11 ms | 0.11 ms | 0.12 ms | 0.11 ms | Tie 🤝 |
| useOnyx Hook Performance useOnyx - selector with data updates | 0.16 ms | 0.15 ms | **0.11 ms** | 0.19 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - multiple hooks in one component | 0.15 ms | 0.16 ms | 0.16 ms | 0.15 ms | Tie 🤝 |
| useOnyx Hook Performance useOnyx - multiple hooks with updates | 0.44 ms | 0.41 ms | **0.14 ms** | 0.46 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - collection member updates | 0.38 ms | 0.39 ms | **0.11 ms** | 0.40 ms | ProxyBased 🏆 |
| useOnyx Hook Performance useOnyx - stress test with 20 hooks | 1.8 ms | 1.4 ms | **0.16 ms** | 2.1 ms | ProxyBased 🏆 |

## Mixed Workload

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Mixed Workload realistic workload - reads, writes, and subscriptions | 0.19 ms | 0.15 ms | 0.39 ms | 0.15 ms | Tie 🤝 |

## Memory and Cache

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Memory and Cache cache thrashing - exceed cache size | 13.5 ms | 5.9 ms | 9.0 ms | 6.0 ms | Tie 🤝 |

## Large Objects

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Large Objects large object - single 10KB object | 0.27 ms | 0.25 ms | 0.26 ms | 0.25 ms | Tie 🤝 |
| Large Objects large object - merge deeply nested object | < 0.01 ms | < 0.01 ms | 0.01 ms | < 0.01 ms | Tie 🤝 |

## Summary

### Test Wins by Prototype

🥇 **StoreBased**: 5 wins
🥈 **ProxyBased**: 5 wins
🥉 **KeyBased**: 1 wins
   **ObserverBased**: 1 wins

## Key Insights

- **Overall Best Performance**: StoreBased won the most tests (5 wins)

### KeyBased Strengths

- **Basic Operations clear - with 1000 keys**: 135% faster than average
- **Subscription Performance notify - update key with 50 subscribers**: 51% faster than average

### StoreBased Strengths

- **Basic Operations merge - 1000 individual key merges**: 98% faster than average
- **Collection Operations mergeCollection - bulk insert 1000 items**: 196% faster than average
- **Collection Operations mergeCollection - update 500 of 1000 items**: 349% faster than average
- **Subscription Performance subscribe - 100 subscribers to same key**: 96% faster than average
- **Subscription Performance subscribe - 100 subscribers to different keys**: 146% faster than average
- **Memory and Cache cache thrashing - exceed cache size**: 62% faster than average
- **Large Objects large object - merge deeply nested object**: 45% faster than average

### ProxyBased Strengths

- **useOnyx Hook Performance useOnyx - re-render on data update**: 255% faster than average
- **useOnyx Hook Performance useOnyx - selector with data updates**: 52% faster than average
- **useOnyx Hook Performance useOnyx - multiple hooks with updates**: 214% faster than average
- **useOnyx Hook Performance useOnyx - collection member updates**: 271% faster than average
- **useOnyx Hook Performance useOnyx - stress test with 20 hooks**: 1042% faster than average

### ObserverBased Strengths

- **Basic Operations get - 1000 cached reads**: 34% faster than average
- **Subscription Performance notify - scattered updates with 100 total subscribers**: 394% faster than average
- **Mixed Workload realistic workload - reads, writes, and subscriptions**: 61% faster than average

## How to Read This Report

- **Winner**: The prototype with the fastest average duration for each test
- A winner is only declared if it is at least 10% faster than others (otherwise marked as "Tie")
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

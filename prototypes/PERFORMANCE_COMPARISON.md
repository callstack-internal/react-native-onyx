# Onyx Prototypes Performance Comparison

*Generated: 2025-11-27T14:23:15.073Z*

## Overview

This report compares the performance of 4 Onyx prototype implementations:

- **KeyBased**: Per-key subscriptions with individual storage
- **StoreBased**: Global store with collection-based storage
- **ProxyBased**: Proxy-based reactive system
- **ObserverBased**: Observer pattern implementation

## Basic Operations

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Basic Operations set - 1000 individual key sets | 2.1 ms | 2.2 ms | 2.8 ms | 2.0 ms | Tie 🤝 |
| Basic Operations merge - 1000 individual key merges | 4.2 ms | **1.9 ms** | 5.1 ms | 3.6 ms | StoreBased 🏆 |
| Basic Operations get - 1000 cached reads | 0.64 ms | 0.62 ms | 1.5 ms | 0.59 ms | Tie 🤝 |
| Basic Operations clear - with 1000 keys | **0.16 ms** | 0.45 ms | 0.53 ms | 0.29 ms | KeyBased 🏆 |

## Collection Operations

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Collection Operations mergeCollection - bulk insert 1000 items | 4.3 ms | **1.3 ms** | 4.9 ms | 1.8 ms | StoreBased 🏆 |
| Collection Operations mergeCollection - update 500 of 1000 items | 1.6 ms | 0.55 ms | 4.5 ms | 0.59 ms | Tie 🤝 |

## Subscription Performance

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Subscription Performance subscribe - 100 subscribers to same key | 0.12 ms | **0.05 ms** | 0.12 ms | 0.10 ms | StoreBased 🏆 |
| Subscription Performance subscribe - 100 subscribers to different keys | 0.15 ms | **0.06 ms** | 0.15 ms | 0.09 ms | StoreBased 🏆 |
| Subscription Performance notify - update key with 50 subscribers | 0.88 ms | 0.82 ms | 1.4 ms | **0.57 ms** | ObserverBased 🏆 |
| Subscription Performance notify - scattered updates with 100 total subscribers | 0.07 ms | 0.17 ms | 0.18 ms | **0.03 ms** | ObserverBased 🏆 |

## Mixed Workload

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Mixed Workload realistic workload - reads, writes, and subscriptions | 0.29 ms | 0.13 ms | 0.38 ms | 0.13 ms | Tie 🤝 |

## Memory and Cache

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Memory and Cache cache thrashing - exceed cache size | 20.2 ms | 5.4 ms | 9.2 ms | 5.3 ms | Tie 🤝 |

## Large Objects

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Large Objects large object - single 10KB object | 0.29 ms | 0.27 ms | 0.29 ms | 0.28 ms | Tie 🤝 |
| Large Objects large object - merge deeply nested object | 0.01 ms | **< 0.01 ms** | 0.01 ms | < 0.01 ms | StoreBased 🏆 |

## Summary

### Test Wins by Prototype

🥇 **StoreBased**: 5 wins
🥈 **ObserverBased**: 2 wins
🥉 **KeyBased**: 1 wins
   **ProxyBased**: 0 wins

## Key Insights

- **Overall Best Performance**: StoreBased won the most tests (5 wins)

### KeyBased Strengths

- **Basic Operations clear - with 1000 keys**: 156% faster than average

### StoreBased Strengths

- **Basic Operations merge - 1000 individual key merges**: 121% faster than average
- **Collection Operations mergeCollection - bulk insert 1000 items**: 176% faster than average
- **Collection Operations mergeCollection - update 500 of 1000 items**: 304% faster than average
- **Subscription Performance subscribe - 100 subscribers to same key**: 136% faster than average
- **Subscription Performance subscribe - 100 subscribers to different keys**: 128% faster than average
- **Large Objects large object - merge deeply nested object**: 98% faster than average

### ObserverBased Strengths

- **Basic Operations get - 1000 cached reads**: 57% faster than average
- **Subscription Performance notify - update key with 50 subscribers**: 78% faster than average
- **Subscription Performance notify - scattered updates with 100 total subscribers**: 447% faster than average
- **Mixed Workload realistic workload - reads, writes, and subscriptions**: 99% faster than average
- **Memory and Cache cache thrashing - exceed cache size**: 121% faster than average

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

# Onyx Prototypes Performance Comparison

*Generated: 2025-11-28T13:28:22.428Z*

## Overview

This report compares the performance of 4 Onyx prototype implementations:

- **KeyBased**: Per-key subscriptions with individual storage
- **StoreBased**: Global store with collection-based storage
- **ProxyBased**: Proxy-based reactive system
- **ObserverBased**: Observer pattern implementation

## Basic Operations

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Basic Operations set - 1000 individual key sets | 2.2 ms | 2.0 ms | 2.6 ms | 2.2 ms | Tie 🤝 |
| Basic Operations merge - 1000 individual key merges | 4.5 ms | **2.2 ms** | 5.0 ms | 3.9 ms | StoreBased 🏆 |
| Basic Operations get - 1000 cached reads | 0.68 ms | 0.64 ms | 1.2 ms | 0.69 ms | Tie 🤝 |
| Basic Operations clear - with 1000 keys | **0.18 ms** | 0.39 ms | 0.55 ms | 0.35 ms | KeyBased 🏆 |

## Collection Operations

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Collection Operations mergeCollection - bulk insert 1000 items | 4.6 ms | **1.4 ms** | 5.1 ms | 2.0 ms | StoreBased 🏆 |
| Collection Operations mergeCollection - update 500 of 1000 items | 1.8 ms | **0.58 ms** | 4.9 ms | 0.66 ms | StoreBased 🏆 |

## Subscription Performance

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Subscription Performance subscribe - 100 subscribers to same key | 0.14 ms | **0.06 ms** | 0.13 ms | 0.10 ms | StoreBased 🏆 |
| Subscription Performance subscribe - 100 subscribers to different keys | 0.20 ms | **0.07 ms** | 0.18 ms | 0.11 ms | StoreBased 🏆 |
| Subscription Performance notify - update key with 50 subscribers | **0.68 ms** | 0.95 ms | 1.5 ms | 0.77 ms | KeyBased 🏆 |
| Subscription Performance notify - scattered updates with 100 total subscribers | 0.04 ms | 0.19 ms | 0.22 ms | **0.03 ms** | ObserverBased 🏆 |

## Mixed Workload

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Mixed Workload realistic workload - reads, writes, and subscriptions | 0.19 ms | 0.16 ms | 0.41 ms | 0.15 ms | Tie 🤝 |

## Memory and Cache

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Memory and Cache cache thrashing - exceed cache size | 13.3 ms | **5.5 ms** | 8.8 ms | 6.4 ms | StoreBased 🏆 |

## Large Objects

| Test | KeyBased | StoreBased | ProxyBased | ObserverBased | Winner |
|------|----------|------------|------------|---------------|--------|
| Large Objects large object - single 10KB object | 0.27 ms | 0.26 ms | 0.25 ms | 0.26 ms | Tie 🤝 |
| Large Objects large object - merge deeply nested object | < 0.01 ms | **< 0.01 ms** | 0.01 ms | < 0.01 ms | StoreBased 🏆 |

## Summary

### Test Wins by Prototype

🥇 **StoreBased**: 7 wins
🥈 **KeyBased**: 2 wins
🥉 **ObserverBased**: 1 wins
   **ProxyBased**: 0 wins

## Key Insights

- **Overall Best Performance**: StoreBased won the most tests (7 wins)

### KeyBased Strengths

- **Basic Operations clear - with 1000 keys**: 144% faster than average
- **Subscription Performance notify - update key with 50 subscribers**: 60% faster than average

### StoreBased Strengths

- **Basic Operations merge - 1000 individual key merges**: 104% faster than average
- **Basic Operations get - 1000 cached reads**: 36% faster than average
- **Collection Operations mergeCollection - bulk insert 1000 items**: 186% faster than average
- **Collection Operations mergeCollection - update 500 of 1000 items**: 320% faster than average
- **Subscription Performance subscribe - 100 subscribers to same key**: 110% faster than average
- **Subscription Performance subscribe - 100 subscribers to different keys**: 146% faster than average
- **Memory and Cache cache thrashing - exceed cache size**: 73% faster than average
- **Large Objects large object - merge deeply nested object**: 53% faster than average

### ObserverBased Strengths

- **Subscription Performance notify - scattered updates with 100 total subscribers**: 422% faster than average
- **Mixed Workload realistic workload - reads, writes, and subscriptions**: 66% faster than average

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

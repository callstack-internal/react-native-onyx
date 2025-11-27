# Performance Comparison Results

## KeyBased vs StoreBased Approaches

### Test Results Summary

| Test | KeyBased | StoreBased | Winner | % Difference |
|------|----------|------------|--------|--------------|
| Subscribe 100 listeners to same key | 0.27ms | **0.16ms** | **StoreBased** | **68.8% faster** |
| Subscribe to 100 different keys | **0.56ms** | 1.15ms | **KeyBased** | **105.4% faster** |
| Set 100 collection items individually | 0.24ms | **0.14ms** | **StoreBased** | **71.4% faster** |
| Merge 100 collection items in bulk | 0.43ms | **0.26ms** | **StoreBased** | **65.4% faster** |
| Read 100 keys (with cache) | 0.04ms | **0.03ms** | **StoreBased** | **33.3% faster** |
| 100 updates with 50 subscribers | **0.29ms** | 0.72ms | **KeyBased** | **148.3% faster** |

### Overall Winner: **StoreBased (4 wins vs 2 wins)**

---

## Detailed Analysis

### 🟢 StoreBased Wins

#### 1. **Subscribe 100 listeners to same key** (68.8% faster)
- **Why**: Single global subscription target means less overhead
- All listeners subscribe to the same store, no per-key subscription management
- KeyBased creates separate callback entries for each subscriber

#### 2. **Set 100 collection items individually** (71.4% faster)
- **Why**: Collection-based storage writes entire collection once
- StoreBased: 1 storage write per item (updates collection)
- KeyBased: Each item triggers full storage flow

#### 3. **Merge 100 collection items in bulk** (65.4% faster)
- **Why**: StoreBased's `mergeCollection` leverages collection storage
- Single write for entire collection vs multiple writes
- Optimal use case for collection-based storage

#### 4. **Read 100 keys (with cache)** (33.3% faster)
- **Why**: Slightly faster cache access in StoreBased
- Both have cache, but StoreBased's simpler structure has less overhead

### 🔵 KeyBased Wins

#### 1. **Subscribe to 100 different keys** (105.4% faster)
- **Why**: Per-key subscriptions are more efficient for scattered data
- KeyBased: Each key has its own subscriber set
- StoreBased: All subscribe to global store, more filtering needed

#### 2. **100 updates with 50 subscribers** (148.3% faster)
- **Why**: KeyBased only notifies subscribers of changed key
- StoreBased: Notifies ALL listeners on any change (they filter via selectors)
- With many subscribers, KeyBased's targeted notifications win

---

## Key Insights

### When to Use StoreBased ✅

1. **Many subscribers to same data**
   - Multiple components reading the same key
   - Global store subscription is more efficient

2. **Collection operations**
   - Bulk updates to collections
   - Loading/saving entire collections at once

3. **Dense data access patterns**
   - Most keys are accessed most of the time
   - Collection-based storage is beneficial

### When to Use KeyBased ✅

1. **Sparse subscriptions across many keys**
   - Each component subscribes to different keys
   - Per-key subscriptions reduce overhead

2. **Frequent updates with many total subscribers**
   - Many subscribers across different keys
   - Targeted notifications prevent unnecessary work

3. **Large collections with partial access**
   - Only need to load few items from large collection
   - Individual key storage allows lazy loading

---

## Architecture Trade-offs

### StoreBased
**Pros:**
- ✅ Faster for concentrated workloads (same key, collections)
- ✅ Simpler subscription model (one store, stable target)
- ✅ Better for collection operations (atomic writes)
- ✅ Stable subscription function in React hooks

**Cons:**
- ❌ Slower when many subscribers spread across keys
- ❌ Global notifications (all listeners called on any change)
- ❌ Must load entire collections

### KeyBased
**Pros:**
- ✅ Faster for distributed workloads (many different keys)
- ✅ Targeted notifications (only relevant subscribers called)
- ✅ Individual key storage (lazy loading possible)
- ✅ Better isolation between keys

**Cons:**
- ❌ More subscription overhead for concentrated workloads
- ❌ Subscription function changes per key in React hooks
- ❌ More storage writes for collections

---

## Recommendations

### For Production Use

**Hybrid Approach:**
```typescript
// Use StoreBased for:
- Global app state (session, user settings)
- Small-medium collections (<100 items)
- Frequently accessed together data

// Use KeyBased for:
- Large sparse collections (1000s of reports, transactions)
- Per-user/per-item data with selective access
- High-frequency updates with many scattered subscribers
```

### Optimization Tips

**StoreBased:**
1. Always use selectors in `useOnyx` to prevent unnecessary re-renders
2. Use `mergeCollection` for bulk updates
3. Keep collections reasonably sized (<1000 items)

**KeyBased:**
1. Use Cache effectively (tune `maxCachedKeysCount`)
2. Batch collection updates when possible
3. Consider per-key subscription costs

---

## Running the Tests

```bash
# Run performance comparison
npx tsx prototypes/perf-test.js

# Or with node (after building)
node prototypes/perf-test.js
```

---

## Conclusion

Both approaches have their strengths:

- **StoreBased**: Better for **concentrated workloads** (same keys, collections, global state)
- **KeyBased**: Better for **distributed workloads** (many keys, scattered subscriptions)

Choose based on your app's data access patterns, or use a hybrid approach for optimal performance!
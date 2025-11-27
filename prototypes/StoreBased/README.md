## Store-Based Onyx Implementation

This is a store-based prototype that uses a **global store** with **collection-based storage** for improved performance and simpler subscription management.

## Key Differences from KeyBased

### 1. Storage Architecture

**KeyBased:**
```
Storage:
  session → { userId: '123', email: 'user@example.com' }
  report_001 → { id: '001', title: 'Report 1' }
  report_002 → { id: '002', title: 'Report 2' }
  report_003 → { id: '003', title: 'Report 3' }
```

**StoreBased (Collection Storage):**
```
Storage:
  session → { userId: '123', email: 'user@example.com' }
  report_ → {
    report_001: { id: '001', title: 'Report 1' },
    report_002: { id: '002', title: 'Report 2' },
    report_003: { id: '003', title: 'Report 3' }
  }
```

**Benefits:**
- ✅ **Fewer storage operations**: 1 write for entire collection vs N writes
- ✅ **Atomic updates**: Multiple items updated together
- ✅ **Faster initialization**: Load entire collection at once

### 2. Subscription Architecture

**KeyBased:**
```typescript
// Each key has its own Set of subscribers
subscribers: Map<OnyxKey, Set<Callback>>

// Example:
'session' -> [callback1, callback2, callback3]
'report_001' -> [callback4, callback5]
'report_002' -> [callback6]
```

**StoreBased:**
```typescript
// ONE global store, all components subscribe to it
store: {
  state: OnyxState,
  listeners: Set<Listener>  // All subscribers here!
}

// Example:
listeners: [listener1, listener2, listener3, listener4, listener5, listener6]
// All listening to the SAME store
```

**Benefits:**
- ✅ **Stable subscription target**: Components always subscribe to the same store object
- ✅ **Constant subscription logic**: Hook implementation doesn't change per key
- ✅ **Simpler mental model**: One store, many readers
- ✅ **Reduced subscription overhead**: Single subscribe/unsubscribe point

### 3. useOnyx Hook Behavior

**KeyBased:**
```typescript
// Subscribe to specific key
const subscribe = useCallback((onStoreChange) => {
    connectionRef.current = Onyx.connect({
        key,  // Different key per hook!
        callback: () => onStoreChange(),
    });
    return () => Onyx.disconnect(connectionRef.current);
}, [key]);  // Changes when key changes
```

**StoreBased:**
```typescript
// Subscribe to global store (always the same)
const subscribe = useCallback((onStoreChange) => {
    return OnyxStore.subscribe(onStoreChange);
}, []);  // Empty deps - subscription target NEVER changes!

// Selector extracts the data we need
const getSnapshot = useCallback(() => {
    const state = OnyxStore.getState();
    return state[key];  // Extract our key's value
}, [key]);
```

**Benefits:**
- ✅ Subscription function is stable (doesn't recreate)
- ✅ useSyncExternalStore optimizations work better
- ✅ Less subscription churn when keys change

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Components                         │
│  (All subscribe to same store, use selectors)       │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│                  OnyxStore                           │
│  - Manages subscribers: Set<Listener> (ONE set)     │
│  - Notifies ALL listeners on any change             │
│  - Delegates data storage to Cache                  │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│                    Cache                             │
│  - Holds in-memory data: Map<OnyxKey, OnyxValue>   │
│  - LRU eviction when maxSize exceeded               │
│  - Fast synchronous reads                           │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│                   Storage                            │
│  - Regular keys: stored individually                │
│  - Collections: stored as single entry              │
│  - e.g., 'report_' → { report_001: {...}, ... }    │
└─────────────────────────────────────────────────────┘
```

## API Reference

The API is the **same** as KeyBased approach:

```typescript
// Initialize
await Onyx.init({ maxCachedKeysCount: 1000 });

// Set/Get
await Onyx.set('session', { userId: '123' });
const session = await Onyx.get('session');

// Merge
await Onyx.merge('session', { email: 'new@example.com' });

// Merge collection (VERY efficient with collection storage!)
await Onyx.mergeCollection('report_', {
    'report_001': { title: 'Updated Report 1' },
    'report_002': { title: 'Updated Report 2' },
});

// React hook
function MyComponent() {
    const [session, metadata] = useOnyx('session');

    // With selector (optimized)
    const [email] = useOnyx('session', {
        selector: (s) => s?.email
    });
}

// Non-React
const connection = Onyx.connect({
    key: 'session',
    callback: (value) => console.log(value),
});
```

## Performance Characteristics

### Storage Operations

**KeyBased:**
- Set 100 collection items: **100 storage writes**
- Update 10 items: **10 storage writes**

**StoreBased:**
- Set 100 collection items: **1 storage write** ✅
- Update 10 items: **1 storage write** ✅

### Subscription Management

**KeyBased:**
```
100 components → 100 different subscriptions
(Each component subscribes to its specific key)
```

**StoreBased:**
```
100 components → 1 subscription target
(All components subscribe to same store)
```

### Re-render Behavior

Both approaches can prevent unnecessary re-renders with selectors:

```typescript
// Only re-renders when email changes
const [email] = useOnyx('session', {
    selector: (session) => session?.email
});
```

**KeyBased:** Selector prevents re-render at callback level
**StoreBased:** Selector prevents re-render at useSyncExternalStore level

## Trade-offs

### StoreBased Advantages ✅

1. **Fewer storage operations** - Collections stored together
2. **Atomic collection updates** - All-or-nothing writes
3. **Stable subscription target** - Better React optimization
4. **Simpler subscription model** - One store, many readers
5. **Better for bulk updates** - Update many items at once

### StoreBased Disadvantages ⚠️

1. **All-or-nothing loading** - Must load entire collection
2. **Larger storage writes** - Writing one item = writing entire collection
3. **Memory usage** - Large collections always fully loaded
4. **Global notifications** - All listeners notified on any change (mitigated by selectors)

### When to Use StoreBased

✅ **Good for:**
- Applications with many small collections
- Bulk update patterns (e.g., sync operations)
- Components that need multiple keys
- Apps where most data is needed most of the time

❌ **Less ideal for:**
- Very large collections (1000s of items)
- Sparse data access patterns (only need few items from large collection)
- Frequent single-item updates in large collections

## Cache Layer

StoreBased includes a **Cache layer with LRU eviction** (just like KeyBased):

```typescript
// Configure cache size during init
await Onyx.init({ maxCachedKeysCount: 1000 });
```

**Cache features:**
- ✅ **LRU eviction**: Least recently used keys are evicted when cache is full
- ✅ **Fast synchronous reads**: Cache data is available immediately
- ✅ **Automatic management**: OnyxStore delegates all data storage to Cache
- ✅ **Memory efficiency**: Prevents unlimited memory growth

**Architecture separation:**
- **Cache**: Holds the data + handles LRU eviction
- **OnyxStore**: Manages subscribers + delegates to Cache for data
- **Storage**: Persistent storage (collection-based)

## File Structure

```
prototypes/StoreBased/
├── types.ts              # TypeScript type definitions
├── StorageProvider.ts    # Memory storage provider
├── Storage.ts            # Collection-based storage layer
├── Cache.ts              # LRU cache (holds actual data)
├── OnyxStore.ts          # Global store with subscriber management
├── Onyx.ts              # Main API
├── useOnyx.ts           # React hook (subscribes to global store)
└── README.md            # This file
```

## Code Comparison

### Subscribing to Data

**KeyBased:**
```typescript
// Each key has separate subscribers
subscribers.get('session').add(callback1);
subscribers.get('session').add(callback2);
subscribers.get('report_001').add(callback3);

// 3 separate subscription sets
```

**StoreBased:**
```typescript
// All components subscribe to same store
store.subscribe(listener1);  // For 'session'
store.subscribe(listener2);  // For 'session' too
store.subscribe(listener3);  // For 'report_001'

// 1 subscription set, 3 listeners
```

### Notifying Subscribers

**KeyBased:**
```typescript
// Only notify subscribers of changed key
const keySubscribers = subscribers.get('session');
keySubscribers.forEach(callback => callback(newValue));
```

**StoreBased:**
```typescript
// Notify ALL subscribers (they filter via selectors)
allListeners.forEach(listener => listener());
// Each listener checks if their data changed
```

## Examples

The API provides the following capabilities:

1. Basic useOnyx usage
2. Selectors for optimized re-renders
3. Multiple components subscribing to same store
4. Collection operations
5. Bulk updates (efficient with collection storage)

## Comparison Summary

| Feature | KeyBased | StoreBased |
|---------|----------|------------|
| Storage Structure | Individual keys | Collections grouped |
| Storage Writes (100 items) | 100 writes | 1 write |
| Subscription Target | Per-key | Global store |
| Subscription Stability | Changes per key | Always stable |
| Memory Usage | Load on demand | Load full collections |
| Best For | Large sparse collections | Small-medium collections |

## Next Steps

1. Compare performance with KeyBased for your use case
2. Consider hybrid approach (StoreBased for most data, KeyBased for large sparse collections)

## Notes

- This is a prototype for understanding store-based architecture
- For production, consider:
  - Lazy loading for large collections
  - Hybrid storage (collections for small data, individual for large)
  - Virtual scrolling for collection UI
  - Incremental collection loading
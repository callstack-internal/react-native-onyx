# Store-Based Onyx Implementation

This is a store-based prototype inspired by **Zustand** that uses a **global store** pattern for state management.

## Key Innovation: Global Store with Centralized State

**The Big Difference:**
```typescript
// KeyBased: Per-key subscriptions
subscribers.get('session') → Set<Callback>
subscribers.get('report_001') → Set<Callback>
// Each key has its own subscriber set

// StoreBased: Global store subscriptions
store.subscribe(listener1);
store.subscribe(listener2);
// All listeners subscribe to the same store
```

**Benefits:**
- ✅ **Simpler subscription model**: Single subscription target for all listeners
- ✅ **Better for concentrated workloads**: Faster when many components read the same keys
- ✅ **Collection-based storage**: Efficient bulk operations for collections
- ✅ **Stable subscription function**: React hooks have stable subscription target
- ✅ **Centralized state**: All state in one place, easier to reason about

## How It Works

### 1. Global Store Pattern

**Core Concepts (inspired by Zustand):**

```typescript
// 1. All state lives in a global store
const store = {
    session: { userId: '123' },
    userSettings: { theme: 'dark' },
    reports: { /* ... */ }
};

// 2. All listeners subscribe to the store
store.subscribe(() => {
    // Called on ANY state change
    // Components filter via selectors
});

// 3. Single source of truth
store.set('session', newSession);  // All subscribers notified
```

**How the Store Works:**

```typescript
// Store structure
const OnyxStore = {
    state: {},              // Global state object
    listeners: Set(),       // All subscribers
    version: 0,            // Change tracking

    set(key, value) {
        this.state[key] = value;
        this.version++;
        this.notifyListeners();  // Notify ALL listeners
    }
};

// Components filter via selectors
const [email] = useOnyx('session', {
    selector: (session) => session?.email
});
```

### 2. Collection-Based Storage

**StoreBased vs KeyBased Storage:**

```typescript
// KeyBased: Individual key storage
Storage.setItem('report_001', report1);  // Write 1
Storage.setItem('report_002', report2);  // Write 2
Storage.setItem('report_003', report3);  // Write 3
// Result: 3 storage writes

// StoreBased: Collection-based storage
Storage.multiSet([
    ['report_001', report1],
    ['report_002', report2],
    ['report_003', report3],
]);
// Result: 1 storage write (batched)
```

**Why This Matters:**

```typescript
// Bulk updates are faster
await Onyx.mergeCollection('report_', {
    'report_001': { title: 'Updated 1' },
    'report_002': { title: 'Updated 2' },
    'report_003': { title: 'Updated 3' },
});
// Single storage write, single notification
```

### 3. Selector-Based Filtering

**Components use selectors to prevent unnecessary re-renders:**

```typescript
// Without selector: re-renders on any store change
const [state] = useOnyx('session');  // ⚠️ Re-renders on ANY store change

// With selector: only re-renders when selector result changes
const [email] = useOnyx('session', {
    selector: (session) => session?.email
});  // ✅ Only re-renders when email changes
```

## Architecture Comparison

### Store-Based Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Components                         │
│  (All subscribe to global store)                    │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│                 OnyxStore (Global)                   │
│  - state: { session, reports, settings, ... }      │
│  - listeners: Set<Listener>                         │
│  - All mutations trigger all listeners              │
│  - Components filter via selectors                  │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│                   Storage                            │
│  - Collection-based storage                         │
│  - Batch operations (multiSet, multiGet)            │
└─────────────────────────────────────────────────────┘
```

## Comparison with Other Approaches

### Subscription Model

**KeyBased:**
```typescript
// Per-key subscriptions
subscribers.get('session') → Set<Callback>
subscribers.get('report_001') → Set<Callback>

// When 'session' changes:
notifySubscribers('session');  // Only notifies 'session' subscribers ✅
```

**StoreBased:**
```typescript
// Global store subscriptions
store.listeners → Set<Listener>

// When 'session' changes:
store.listeners.forEach(listener => listener());  // Notifies ALL ⚠️
// Components filter via selectors
```

**ProxyBased:**
```typescript
// Similar to StoreBased
proxyState.listeners → Set<Listener>

// When ANY mutation:
listeners.forEach(listener => listener());  // Notifies ALL ⚠️
```

**ObserverBased:**
```typescript
// Per-observable subscriptions
observable('session').observers → Set<Observer>

// When observable changes:
observable.observers.forEach(observer => observer());  // Only this observable's observers ✅
```

### Performance Characteristics

| Test Scenario | KeyBased | StoreBased | Winner |
|---------------|----------|------------|--------|
| Subscribe 100 listeners to same key | 0.27ms | **0.16ms** | **StoreBased** |
| Subscribe to 100 different keys | **0.56ms** | 1.15ms | **KeyBased** |
| Set 100 collection items | 0.24ms | **0.14ms** | **StoreBased** |
| Merge 100 collection items | 0.43ms | **0.26ms** | **StoreBased** |
| 100 updates with 50 subscribers | **0.29ms** | 0.72ms | **KeyBased** |

**Key Insight:**
- **StoreBased wins**: When many components access same keys (concentrated workloads)
- **KeyBased wins**: When components access different keys (distributed workloads)

## API Reference

### Initialization

```typescript
await Onyx.init({
    maxCachedKeysCount: 1000,  // Optional
    keys: {                     // Optional: initial data
        session: { userId: '123' },
    },
});
```

### Basic Operations

```typescript
// Set a value
await Onyx.set('session', {
    userId: '123',
    email: 'user@example.com',
});

// Get a value
const session = await Onyx.get('session');

// Merge with existing value
await Onyx.merge('session', { email: 'new@example.com' });

// Remove a value
await Onyx.remove('session');

// Clear all data
await Onyx.clear();
```

### Collection Operations

```typescript
// Merge multiple collection items at once
await Onyx.mergeCollection('report_', {
    'report_001': { title: 'Updated Report 1' },
    'report_002': { title: 'New Report 2' },
});
// Single storage write, single notification!
```

### React Hook

```typescript
function useOnyx<TValue, TReturnValue>(
    key: string,
    options?: {
        selector?: (data: TValue | null) => TReturnValue;
        initWithStoredValues?: boolean;
    }
): [TReturnValue | null, { status: 'loading' | 'loaded' }]
```

**Basic Usage:**

```typescript
function SessionDisplay() {
    const [session, metadata] = useOnyx('session');

    if (metadata.status === 'loading') {
        return <div>Loading...</div>;
    }

    return <div>{session?.email}</div>;
}
```

**With Selector (Recommended):**

```typescript
function UserEmail() {
    // Only re-renders when email changes
    const [email] = useOnyx('session', {
        selector: (session) => session?.email ?? 'Not logged in',
    });

    return <div>Email: {email}</div>;
}
```

**IMPORTANT:** Always use selectors to prevent unnecessary re-renders! Without selectors, components re-render on ANY store change.

### Non-React Subscriptions

```typescript
// Subscribe to key changes
const connection = Onyx.connect({
    key: 'session',
    callback: (value) => {
        console.log('Session changed:', value);
    },
});

// Unsubscribe
Onyx.disconnect(connection);
```

## Examples

### Example 1: Session Management

```typescript
// Initialize
await Onyx.init();

// Set session
await Onyx.set('session', {
    userId: '123',
    authToken: 'token',
    email: 'user@example.com',
});

// Update email only
await Onyx.merge('session', {
    email: 'newemail@example.com',
});

// Get session
const session = await Onyx.get('session');

// Remove session
await Onyx.remove('session');
```

### Example 2: Collections

```typescript
// Add individual reports
await Onyx.set('report_001', {
    id: '001',
    title: 'Q1 Report',
});

await Onyx.set('report_002', {
    id: '002',
    title: 'Q2 Report',
});

// Bulk update - much faster!
await Onyx.mergeCollection('report_', {
    'report_001': { title: 'Updated Q1 Report' },
    'report_002': { title: 'Updated Q2 Report' },
    'report_003': { id: '003', title: 'Q3 Report' },
});
```

### Example 3: React Component with Selectors

```typescript
function SessionManager() {
    // Only re-renders when session changes (not when other keys change)
    const [session] = useOnyx('session', {
        selector: (s) => s,  // Identity selector
    });

    const handleLogin = async () => {
        await Onyx.set('session', {
            userId: '123',
            authToken: 'token',
            email: 'user@example.com',
        });
    };

    const handleLogout = async () => {
        await Onyx.remove('session');
    };

    return (
        <div>
            {session ? (
                <>
                    <p>Logged in as: {session.email}</p>
                    <button onClick={handleLogout}>Logout</button>
                </>
            ) : (
                <button onClick={handleLogin}>Login</button>
            )}
        </div>
    );
}
```

### Example 4: Multiple Components with Selectors

```typescript
// Component 1: Only re-renders when email changes
function UserEmail() {
    const [email] = useOnyx('session', {
        selector: (s) => s?.email
    });
    return <div>Email: {email}</div>;
}

// Component 2: Only re-renders when userId changes
function UserId() {
    const [userId] = useOnyx('session', {
        selector: (s) => s?.userId
    });
    return <div>User ID: {userId}</div>;
}

// Update email - only UserEmail re-renders!
await Onyx.merge('session', { email: 'new@example.com' });
```

## Trade-offs

### Advantages ✅

1. **Simpler subscription model**: Single global subscription target
2. **Better for concentrated workloads**: Faster when many components access same keys
3. **Stable subscription function**: React hooks have stable subscription target (better performance)
4. **Collection-based storage**: Efficient bulk operations (single write for collections)
5. **Centralized state**: All state in one place, easier to debug and reason about
6. **Familiar pattern**: Similar to Zustand, Redux

### Disadvantages ⚠️

1. **Global notifications**: All listeners notified on ANY change (mitigated by selectors)
2. **Requires selectors**: Must use selectors to prevent unnecessary re-renders
3. **Less efficient for sparse workloads**: Slower when many components access different keys
4. **Memory usage**: All state loaded in memory (not lazy loaded)

### When to Use StoreBased

✅ **Good for:**
- Apps with many components reading the same keys (concentrated access)
- Small-medium collections (<1000 items per collection)
- Global app state (session, user settings, app config)
- Apps where most data is accessed most of the time
- Teams familiar with Zustand/Redux patterns

❌ **Less ideal for:**
- Large sparse collections with selective access (use KeyBased)
- Apps with many keys but each accessed by few components
- High-frequency updates with many scattered subscribers
- Apps needing lazy loading of data

## Performance Features

### Collection Operations

StoreBased excels at collection operations:

```typescript
// Fast: Single storage write
await Onyx.mergeCollection('report_', {
    'report_001': { title: 'Updated 1' },
    'report_002': { title: 'Updated 2' },
    'report_003': { title: 'Updated 3' },
});

// Slow: Multiple storage writes
await Onyx.merge('report_001', { title: 'Updated 1' });
await Onyx.merge('report_002', { title: 'Updated 2' });
await Onyx.merge('report_003', { title: 'Updated 3' });
```

### Stable Subscription Function

React hooks benefit from stable subscription:

```typescript
// KeyBased: Subscription function changes per key
const subscribe = useCallback(() => {
    return Onyx.connect({ key, callback });
}, [key]);  // Different function for each key

// StoreBased: Subscription function is stable
const subscribe = useMemo(() => {
    return (callback) => OnyxStore.subscribe(callback);
}, []);  // Same function for all keys!
```

### Selector Optimization

**CRITICAL:** Always use selectors to prevent unnecessary re-renders!

```typescript
// Bad: Re-renders on ANY store change ❌
const [session] = useOnyx('session');

// Good: Only re-renders when session changes ✅
const [session] = useOnyx('session', {
    selector: (s) => s
});

// Best: Only re-renders when email changes ✅✅
const [email] = useOnyx('session', {
    selector: (s) => s?.email
});
```

## Similar Libraries

### Zustand

StoreBased is heavily inspired by [Zustand](https://github.com/pmndrs/zustand):

```typescript
// Zustand
import create from 'zustand';

const useStore = create((set) => ({
    session: null,
    setSession: (session) => set({ session }),
}));

function Component() {
    const session = useStore((state) => state.session);
    return <div>{session?.email}</div>;
}

// StoreBased Onyx
import Onyx from './Onyx';
import useOnyx from './useOnyx';

await Onyx.init();

function Component() {
    const [session] = useOnyx('session', {
        selector: (s) => s
    });
    return <div>{session?.email}</div>;
}
```

### Redux

Similar to Redux but simpler:

```typescript
// Redux (complex)
const store = createStore(reducer);
const mapStateToProps = (state) => ({ session: state.session });
const Component = connect(mapStateToProps)(ComponentImpl);

// StoreBased (simpler)
function Component() {
    const [session] = useOnyx('session', {
        selector: (s) => s
    });
}
```

## File Structure

```
prototypes/StoreBased/
├── types.ts              # TypeScript type definitions
├── OnyxStore.ts          # Global store (inspired by Zustand)
│   ├── state            # Global state object
│   ├── listeners        # All subscribers
│   └── notify()         # Notify all listeners
├── Storage.ts            # Storage layer (collection-based)
│   ├── multiSet()       # Batch write
│   └── multiGet()       # Batch read
├── Cache.ts              # Optional LRU cache
├── Onyx.ts              # Main API
├── useOnyx.ts           # React hook (uses selectors)
└── README.md            # This file
```

## Comparison Summary

| Feature | KeyBased | StoreBased | ProxyBased | ObserverBased |
|---------|----------|------------|------------|---------------|
| Subscription Target | Per-key | Global store | Global proxy | Per-observable |
| Notification Pattern | Key-level | Global → Filtered | Global → Filtered | Observable-level |
| Storage Pattern | Individual keys | Collection-based | Individual keys | Individual keys |
| Best For | Distributed workloads | Concentrated workloads | Intuitive API | Maximum performance |
| Memory Usage | Medium | Medium-High | Medium | Medium |
| Learning Curve | Low | Low | Medium | High |

## Best Practices

### 1. Always Use Selectors

```typescript
// Bad ❌
const [state] = useOnyx('session');

// Good ✅
const [session] = useOnyx('session', {
    selector: (s) => s
});

// Best ✅✅
const [email] = useOnyx('session', {
    selector: (s) => s?.email
});
```

### 2. Use mergeCollection for Bulk Updates

```typescript
// Bad ❌
for (const report of reports) {
    await Onyx.merge(`report_${report.id}`, report);
}

// Good ✅
await Onyx.mergeCollection('report_', {
    [`report_${reports[0].id}`]: reports[0],
    [`report_${reports[1].id}`]: reports[1],
    // ...
});
```

### 3. Keep Collections Reasonably Sized

```typescript
// Good ✅
// Collections with <1000 items work great
await Onyx.mergeCollection('report_', smallCollection);

// Consider KeyBased for large collections ⚠️
// Collections with >10,000 items may be slow
```

## Migration from KeyBased

### Before (KeyBased)

```typescript
// Component re-renders only when 'session' changes
const [session] = useOnyx('session');
```

### After (StoreBased)

```typescript
// Must use selector to prevent re-renders on other key changes
const [session] = useOnyx('session', {
    selector: (s) => s
});
```

**Key Difference:** StoreBased requires explicit selectors to filter updates!

## Next Steps

1. Understand the OnyxStore.ts implementation
2. Always use selectors in your hooks
3. Use mergeCollection for bulk updates
4. Compare performance with KeyBased for your use case
5. Consider hybrid approach (StoreBased for global state, KeyBased for large collections)

## Notes

- This is a prototype exploring global store patterns
- For production, consider:
  - Implementing collection size limits
  - Adding DevTools integration
  - Performance profiling for your specific use case
  - Hybrid approach (StoreBased + KeyBased)
- The Storage layer uses in-memory storage by default
- Always use selectors to prevent unnecessary re-renders!
- Similar to Zustand, Redux patterns

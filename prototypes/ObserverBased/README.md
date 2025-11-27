# Observer-Based Onyx Implementation

This is an observer-based prototype inspired by **Legend-State** that uses **observables** for fine-grained reactivity and automatic dependency tracking.

## Key Innovation: Observable Pattern with Fine-Grained Reactivity

**The Big Difference:**
```typescript
// KeyBased & StoreBased: Explicit subscriptions
const connection = Onyx.connect({
    key: 'session',
    callback: (value) => console.log(value)
});

// ObserverBased: Automatic dependency tracking
const sessionObservable = Onyx.getObservable('session');
const value = sessionObservable.get();  // Automatically tracks this access!
```

**Benefits:**
- Fine-grained updates - only re-render what actually changed
- Automatic dependency tracking - no manual subscription management
- Computed values that auto-update when dependencies change
- Memory efficient - observables only notify their specific observers

## How It Works

### 1. Observable Pattern

**Core Concepts (inspired by Legend-State):**

```typescript
// 1. Create an observable
const observable = Onyx.getObservable('session');

// 2. Get value - automatically tracks who's reading
const value = observable.get();  // Tracks this access!

// 3. Set value - automatically notifies observers
observable.set({ userId: '123' });  // All observers notified!
```

**How Observables Work:**

```typescript
// When you read a value during component render:
function MyComponent() {
    const [session] = useOnyx('session');  // Observable tracks this component
    // Component automatically re-renders when session changes!
}

// Behind the scenes:
observable.get() → {
    if (currentObserver) {
        // Add current component as observer
        this.observers.add(currentObserver);
    }
    return this.value;
}

observable.set(newValue) → {
    this.value = newValue;
    // Notify only the components that read this observable
    this.observers.forEach(observer => observer());
}
```

### 2. Automatic Dependency Tracking

```typescript
// Global context tracks which component is currently rendering
let currentObserver = null;

// When component renders:
currentObserver = componentObserver;
observable.get();  // Observable sees currentObserver and tracks it
currentObserver = null;

// When value changes:
observable.set(newValue);  // Only notifies tracked observers!
```

### 3. Fine-Grained Reactivity

**ObserverBased vs Other Approaches:**

```typescript
// KeyBased/StoreBased: Subscribe to entire key
const [session] = useOnyx('session');
// Re-renders when ANY property of session changes

// ObserverBased: Only re-renders for accessed properties
const [session] = useOnyx('session');
console.log(session.email);
// Only re-renders when EMAIL changes, not when userId/authToken/etc. change!
```

## Architecture Comparison

### Observer-Based Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Components                         │
│  (Automatically track which observables they read)  │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│              Observable System                       │
│  - Observable nodes: Map<Key, ObservableNode>       │
│  - Each node tracks its observers: Set<Observer>    │
│  - Automatic dependency tracking via currentObserver│
│  - Fine-grained notifications (only to observers)   │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│                   Storage                            │
│  - Persistence layer                                │
│  - Individual key storage                           │
└─────────────────────────────────────────────────────┘
```

## Comparison with Other Approaches

### Subscription Model

**KeyBased:**
```typescript
// Per-key subscription map
subscribers.get('session') → Set<Callback>
subscribers.get('report_001') → Set<Callback>

// When 'session' changes:
notifySubscribers('session');  // Calls all callbacks for 'session'
```

**StoreBased:**
```typescript
// Global store with all subscribers
store.listeners → Set<Listener>

// When ANY value changes:
store.listeners.forEach(listener => listener());  // Calls ALL listeners
// Components filter via selectors
```

**ProxyBased:**
```typescript
// Global proxy with all subscribers
proxyState.listeners → Set<Listener>

// When proxy trap fires:
listeners.forEach(listener => listener());  // Calls ALL listeners
// Snapshots determine if re-render needed
```

**ObserverBased:**
```typescript
// Each observable tracks its own observers
observable('session').observers → Set<Observer>
observable('report_001').observers → Set<Observer>

// When observable changes:
observable.observers.forEach(observer => observer());  // Only calls THIS observable's observers!
```

### Re-render Granularity

| Approach | What Triggers Re-render | Granularity |
|----------|------------------------|-------------|
| KeyBased | Any change to subscribed key | Key-level |
| StoreBased | Any change to store (filtered by selector) | Store-level → Selector-level |
| ProxyBased | Any proxy mutation (filtered by snapshot) | Global → Snapshot-level |
| ObserverBased | Change to accessed observable | Observable-level (finest) |

### Example: Fine-Grained Updates

```typescript
// Setup: 1000 observables with 1 observer each
for (let i = 0; i < 1000; i++) {
    Onyx.set(`key_${i}`, { value: i });
    useOnyx(`key_${i}`);  // 1000 components
}

// Update one observable
Onyx.set('key_500', { value: 999 });

// What happens?
// KeyBased: Notifies 1 subscriber (key_500) ✅
// StoreBased: Notifies ALL 1000 listeners, selectors filter ⚠️
// ProxyBased: Notifies ALL 1000 listeners, snapshots filter ⚠️
// ObserverBased: Notifies 1 observer (key_500) ✅✅ (most efficient!)
```

## API Reference

### Basic Usage

```typescript
// Initialize
await Onyx.init();

// Set/Get (traditional API)
await Onyx.set('session', { userId: '123' });
const session = await Onyx.get('session');

// Merge
await Onyx.merge('session', { email: 'new@example.com' });

// Merge collection (batched)
await Onyx.mergeCollection('report_', {
    'report_001': { title: 'Updated Report 1' },
    'report_002': { title: 'Updated Report 2' },
});

// Remove
await Onyx.remove('session');

// Clear all
await Onyx.clear();
```

### Observable API (Advanced)

```typescript
// Get observable for a key
const sessionObs = Onyx.getObservable('session');

// Read value (tracks access)
const value = sessionObs.get();

// Set value (notifies observers)
sessionObs.set({ userId: '123' });

// Subscribe to changes
const unsubscribe = sessionObs.observe(() => {
    console.log('Session changed!');
});

// Read without tracking (peek)
const value = sessionObs.peek();  // Doesn't create dependency
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

**Usage:**

```typescript
function SessionDisplay() {
    // Automatically tracks which properties are accessed
    const [session] = useOnyx('session');

    // With selector (still fine-grained)
    const [email] = useOnyx('session', {
        selector: (s) => s?.email
    });
}
```

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

### Example 1: Fine-Grained Component Updates

```typescript
function UserProfile() {
    const [session] = useOnyx('session');

    return (
        <div>
            {/* Only re-renders when email changes */}
            <Email email={session?.email} />

            {/* Only re-renders when userId changes */}
            <UserId id={session?.userId} />
        </div>
    );
}

function Email({ email }) {
    console.log('Email rendered');
    return <div>Email: {email}</div>;
}

function UserId({ id }) {
    console.log('UserId rendered');
    return <div>User ID: {id}</div>;
}

// Update email
await Onyx.merge('session', { email: 'new@example.com' });
// Output: "Email rendered"
// UserId component does NOT re-render! ✅
```

### Example 2: Computed Observables

```typescript
import { computed } from './ObservableSystem';

// Create computed observable that auto-updates
const fullNameObs = computed(() => {
    const user = Onyx.getObservable('user').get();
    return `${user?.firstName} ${user?.lastName}`;
});

// Use in component
function FullName() {
    const [fullName] = useOnyx('user', {
        selector: () => fullNameObs.get()
    });

    return <div>{fullName}</div>;
}

// When user.firstName changes, fullName automatically recomputes!
```

### Example 3: Multiple Observables

```typescript
function Dashboard() {
    const [session] = useOnyx('session');
    const [settings] = useOnyx('userSettings');
    const [reports] = useOnyx('reports');

    // This component only re-renders when session, settings, or reports change
    // NOT when other keys in Onyx change ✅
}
```

### Example 4: Batch Updates

```typescript
import { batch } from './ObservableSystem';

// Update multiple observables at once
batch(() => {
    Onyx.set('session', { userId: '123' });
    Onyx.set('userSettings', { theme: 'dark' });
    Onyx.set('notifications', { count: 5 });
});
// All observers notified once at the end of batch
```

## Trade-offs

### Advantages ✅

1. **Fine-grained reactivity**: Only re-renders components that accessed changed data
2. **Automatic dependency tracking**: No manual subscription management
3. **Memory efficient**: Each observable only tracks its own observers
4. **Computed values**: Derived observables that auto-update
5. **Optimal performance**: Minimal re-renders compared to global subscriptions
6. **Familiar pattern**: Similar to Solid.js signals, Legend-State, MobX

### Disadvantages ⚠️

1. **Complexity**: More complex implementation than simple key-based subscriptions
2. **Learning curve**: Developers need to understand observables and tracking
3. **Debugging**: Can be harder to trace which component caused which update
4. **Memory overhead**: Each observable maintains its own observer set
5. **Not widely adopted**: Less common pattern than Redux/Zustand in React

### When to Use ObserverBased

✅ **Good for:**
- Apps with many small, independent state pieces
- Performance-critical apps needing minimal re-renders
- Apps with complex derived state (computed values)
- Teams familiar with Solid.js, Legend-State, or MobX
- Large-scale apps where fine-grained reactivity matters

❌ **Less ideal for:**
- Simple apps where performance isn't critical
- Teams unfamiliar with observable patterns
- Apps needing extensive DevTools integration
- Quick prototypes (simpler patterns may be faster to implement)

## Performance Characteristics

### Subscription Overhead

**Comparison with 1000 components:**

```typescript
// Setup: 1000 keys, 1 component per key
for (let i = 0; i < 1000; i++) {
    useOnyx(`key_${i}`);
}

// Update 1 key
Onyx.set('key_500', newValue);
```

| Approach | Listeners Notified | Components Re-rendered |
|----------|-------------------|------------------------|
| KeyBased | 1 | 1 |
| StoreBased | 1000 (filtered) | 1 (selector) |
| ProxyBased | 1000 (filtered) | 1 (snapshot) |
| ObserverBased | 1 | 1 |

**Result: ObserverBased is most efficient** - only notifies relevant observer!

### Memory Usage

```typescript
// Memory per observable
Memory = Observer Set + Version Number + Value Reference
       ≈ 100-200 bytes per observable

// With 1000 observables:
Total Memory ≈ 100-200 KB

// Comparison:
// KeyBased: Similar (per-key subscriber sets)
// StoreBased: Lower (one global set, but loses granularity)
// ProxyBased: Similar (proxy cache + snapshot cache)
```

### Fine-Grained Update Performance

**Test: Update 1 property of a large object**

```typescript
const session = {
    userId: '123',
    email: 'user@example.com',
    authToken: 'token...',
    preferences: { /* 100 properties */ },
    metadata: { /* 100 properties */ }
};

// Component only accesses email
function EmailDisplay() {
    const [session] = useOnyx('session');
    return <div>{session.email}</div>;
}

// Update unrelated property
Onyx.merge('session', { authToken: 'new-token' });
```

| Approach | Component Re-renders? |
|----------|----------------------|
| KeyBased | Yes ⚠️ (entire key changed) |
| StoreBased | No ✅ (selector filters) |
| ProxyBased | No ✅ (snapshot comparison) |
| ObserverBased | No ✅ (didn't access authToken) |

## Similar Libraries

### Legend-State

ObserverBased is heavily inspired by [Legend-State](https://github.com/LegendApp/legend-state):

```typescript
// Legend-State
import { observable } from '@legendapp/state';
import { useObservable } from '@legendapp/state/react';

const state$ = observable({ count: 0 });
state$.count.set(1);  // Fine-grained update

function Counter() {
    const count = useObservable(state$.count);
    return <div>{count.get()}</div>;
}

// ObserverBased Onyx
import Onyx from './Onyx';
import useOnyx from './useOnyx';

await Onyx.init();
await Onyx.set('count', 0);
await Onyx.set('count', 1);  // Fine-grained update

function Counter() {
    const [count] = useOnyx('count');
    return <div>{count}</div>;
}
```

### Solid.js Signals

Similar to Solid's signal pattern:

```typescript
// Solid.js
import { createSignal, createEffect } from 'solid-js';

const [count, setCount] = createSignal(0);
createEffect(() => console.log(count()));  // Auto-tracks count

// ObserverBased
const countObs = Onyx.getObservable('count');
countObs.observe(() => console.log(countObs.get()));  // Auto-tracks
```

### MobX Observables

Similar to MobX's observable pattern but simpler:

```typescript
// MobX
import { observable, autorun } from 'mobx';

const state = observable({ count: 0 });
autorun(() => console.log(state.count));  // Auto-tracks

// ObserverBased
const countObs = Onyx.getObservable('count');
countObs.observe(() => console.log(countObs.get()));  // Auto-tracks
```

## File Structure

```
prototypes/ObserverBased/
├── types.ts              # TypeScript type definitions
├── Storage.ts            # Storage layer (individual keys)
├── ObservableSystem.ts   # Observable implementation (inspired by Legend-State)
│   ├── observable()     # Create observable node
│   ├── track()          # Automatic dependency tracking
│   ├── computed()       # Derived observables
│   └── batch()          # Batch updates
├── Onyx.ts              # Main API with observables
├── useOnyx.ts           # React hook (uses observables)
└── README.md            # This file
```

## Advanced Features

### Computed Observables

```typescript
import { computed } from './ObservableSystem';

// Automatically recomputes when dependencies change
const totalPrice = computed(() => {
    const items = Onyx.getObservable('cartItems').get();
    return items.reduce((sum, item) => sum + item.price, 0);
});

// Use in component
function CartTotal() {
    const [total] = useOnyx('cart', {
        selector: () => totalPrice.get()
    });
    return <div>Total: ${total}</div>;
}
```

### Batching Updates

```typescript
import { batch } from './ObservableSystem';

// Multiple updates, single notification
batch(() => {
    Onyx.set('key1', value1);
    Onyx.set('key2', value2);
    Onyx.set('key3', value3);
});
// All observers notified once at the end
```

### Peeking (Non-Tracking Reads)

```typescript
const sessionObs = Onyx.getObservable('session');

// Normal read - tracks access
const value1 = sessionObs.get();  // Creates dependency

// Peek - doesn't track
const value2 = sessionObs.peek();  // No dependency created
```

## Comparison Summary

| Feature | KeyBased | StoreBased | ProxyBased | ObserverBased |
|---------|----------|------------|------------|---------------|
| Subscription Target | Per-key | Global store | Global proxy | Per-observable |
| Notification Pattern | Key-level | Global → Filtered | Global → Filtered | Observable-level |
| Re-render Granularity | Key-level | Selector-level | Snapshot-level | Access-level (finest) |
| Memory Usage | Medium | Low | Medium | Medium |
| Implementation Complexity | Low | Medium | High | High |
| Best For | Simple apps | Collections | Intuitive API | Maximum performance |

## Next Steps

1. Understand the ObservableSystem.ts implementation
2. Try the observable API for fine-grained updates
3. Compare performance with other approaches for your use case
4. Consider hybrid approach (ObserverBased for critical paths, others for less critical)

## Notes

- This is a prototype exploring observable-based reactivity patterns
- For production, consider:
  - DevTools integration for debugging observables
  - Performance profiling for your specific use case
  - Memory profiling with many observables
  - Testing with your actual component structure
- The Storage layer uses in-memory storage by default
- Fine-grained reactivity provides best performance but adds complexity
- Similar to Legend-State, Solid.js signals, MobX observables

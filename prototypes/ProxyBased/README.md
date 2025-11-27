# Proxy-Based Onyx Implementation

This is a proxy-based prototype inspired by **Valtio** that uses **JavaScript Proxies** for automatic reactivity and change detection.

## Key Innovation: Mutable State with Automatic Reactivity

**The Big Difference:**
```typescript
// KeyBased & StoreBased: Explicit mutations
await Onyx.set('session', { userId: '123', email: 'user@example.com' });
await Onyx.merge('session', { email: 'new@example.com' });

// ProxyBased: Direct mutations (Valtio-style)
Onyx.state.session = { userId: '123', email: 'user@example.com' };
Onyx.state.session.email = 'new@example.com';  // Just mutate directly!
```

**Benefits:**
- ✅ **More intuitive**: Mutate state like regular JavaScript objects
- ✅ **Less boilerplate**: No need to call `set()` or `merge()`
- ✅ **Automatic change detection**: Proxies automatically detect and notify
- ✅ **Deep reactivity**: Nested object mutations are tracked automatically

## How It Works

### 1. Proxy-Based Reactive System

**Core Concepts (inspired by Valtio):**

```typescript
// 1. Create a proxy state
const state = proxy({ session: null, reports: {} });

// 2. Mutate directly - Proxy traps detect changes
state.session = { userId: '123' };  // Set trap fires → notifies subscribers

// 3. React components get immutable snapshots
const snap = snapshot(state);  // Frozen copy for React
```

**How Proxies Work:**

```typescript
const proxy = new Proxy(state, {
    // Intercepts property writes
    set(target, prop, value) {
        const oldValue = target[prop];
        target[prop] = value;

        if (oldValue !== value) {
            notifyListeners();  // Automatic notification!
        }

        return true;
    },

    // Intercepts property reads
    get(target, prop) {
        const value = target[prop];

        // Make nested objects reactive too (deep reactivity)
        if (typeof value === 'object') {
            return createProxy(value);
        }

        return value;
    }
});
```

### 2. Immutable Snapshots for React

```typescript
// React components receive frozen snapshots
function useOnyx(key) {
    // Get immutable snapshot of the proxy state
    const snap = snapshot(state);
    return snap[key];  // Returns frozen copy
}
```

**Why snapshots?**
- ✅ Prevents accidental mutations in React components
- ✅ Safe to use in React (no mutable state in components)
- ✅ Cached for performance

### 3. Global Subscribe Pattern

```typescript
// All components subscribe to the same reactive state
subscribe(() => {
    // Called on ANY mutation to the proxy state
});
```

## Architecture Comparison

### Proxy-Based Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Components                         │
│  (Subscribe to global reactive state)               │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│              Reactive System                         │
│  - Proxy state (mutable)                            │
│  - Snapshot cache (immutable)                       │
│  - Global subscribers: Set<Listener>                │
│  - Auto-notification on any mutation                │
└────────────────┬────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────┐
│                   Storage                            │
│  - Persistence layer                                │
│  - Individual key storage (like KeyBased)           │
└─────────────────────────────────────────────────────┘
```

## Comparison with Other Approaches

### Storage Layer

| Approach | Storage Structure | Write Operations (100 items) |
|----------|------------------|------------------------------|
| KeyBased | Individual keys | 100 writes |
| StoreBased | Collections grouped | 1 write |
| ProxyBased | Individual keys | 100 writes |

**ProxyBased uses individual key storage** (like KeyBased) because:
- Proxy reactivity works best with granular updates
- Easier to track individual mutations
- Could be optimized with batching later

### Mutation API

**KeyBased & StoreBased:**
```typescript
// Explicit API calls
await Onyx.set('session', newSession);
await Onyx.merge('session', { email: 'new@example.com' });

// Still async - must await
```

**ProxyBased:**
```typescript
// Direct mutation - more intuitive
Onyx.state.session = newSession;
Onyx.state.session.email = 'new@example.com';

// Synchronous - no await needed!
// (Still persists async in background)
```

### Subscription Model

**KeyBased:**
```typescript
// Per-key subscriptions
subscribers.get('session') → Set<Callback>
subscribers.get('report_001') → Set<Callback>
```

**StoreBased:**
```typescript
// Global store subscriptions
store.subscribe(listener1);
store.subscribe(listener2);
// All subscribe to same store
```

**ProxyBased:**
```typescript
// Global reactive state subscriptions
subscribe(listener1);
subscribe(listener2);
// All subscribe to proxy state changes
```

### React Hook Behavior

**KeyBased:**
```typescript
// Subscribe to specific key
const [session] = useOnyx('session');
// New subscription per key
```

**StoreBased:**
```typescript
// Subscribe to global store, extract key with selector
const [session] = useOnyx('session');
// All hooks subscribe to same store
```

**ProxyBased:**
```typescript
// Subscribe to reactive state, return immutable snapshot
const [session] = useOnyx('session');
// All hooks subscribe to same reactive state
// Returns frozen snapshot for safety
```

## API Reference

### Direct Mutation (Preferred)

```typescript
// Initialize
await Onyx.init();

// Direct mutations - the Valtio way!
Onyx.state.session = {
    userId: '123',
    email: 'user@example.com',
};

// Nested mutations
Onyx.state.session.email = 'new@example.com';

// Arrays
Onyx.state.tags = ['tag1', 'tag2'];
Onyx.state.tags.push('tag3');  // Tracked!

// Delete properties
delete Onyx.state.session.authToken;

// All mutations are automatically:
// 1. Detected by Proxy
// 2. Notified to subscribers
// 3. Persisted to storage (async in background)
```

### Compatibility API (Optional)

For compatibility with existing Onyx code, traditional methods are still available:

```typescript
// Set (uses proxy under the hood)
await Onyx.set('session', { userId: '123' });

// Get
const session = await Onyx.get('session');

// Merge
await Onyx.merge('session', { email: 'new@example.com' });

// Merge collection
await Onyx.mergeCollection('report_', {
    'report_001': { title: 'Updated' },
});

// Remove
await Onyx.remove('session');

// Clear all
await Onyx.clear();
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
    // Get immutable snapshot
    const [session] = useOnyx('session');

    // With selector
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

### Example 1: Direct Mutation

```typescript
// Initialize
await Onyx.init();

// Set data by mutating the state object
Onyx.state.session = {
    userId: '123',
    authToken: 'token',
    email: 'user@example.com',
};

// Update specific fields
Onyx.state.session.email = 'newemail@example.com';
Onyx.state.session.lastLogin = Date.now();

// The Proxy automatically:
// 1. Detects the mutation
// 2. Notifies all subscribers
// 3. Persists to storage
```

### Example 2: Deep Reactivity

```typescript
// Nested objects are automatically reactive
Onyx.state.userSettings = {
    preferences: {
        theme: 'light',
        notifications: {
            email: true,
            push: false,
        },
    },
};

// Deep mutations work!
Onyx.state.userSettings.preferences.theme = 'dark';
Onyx.state.userSettings.preferences.notifications.push = true;

// All tracked automatically by nested proxies
```

### Example 3: Arrays

```typescript
// Arrays are reactive too
Onyx.state.tags = ['work', 'important'];

// Array mutations are tracked
Onyx.state.tags.push('urgent');
Onyx.state.tags[0] = 'personal';
Onyx.state.tags.splice(1, 1);

// All trigger reactivity!
```

### Example 4: React Component

```typescript
function SessionManager() {
    // Get immutable snapshot of session
    const [session] = useOnyx('session');

    const handleLogin = () => {
        // Direct mutation!
        Onyx.state.session = {
            userId: '123',
            authToken: 'token',
            email: 'user@example.com',
        };
    };

    const handleUpdateEmail = () => {
        // Nested mutation!
        Onyx.state.session.email = 'updated@example.com';
    };

    const handleLogout = () => {
        // Delete the property
        delete Onyx.state.session;
    };

    return (
        <div>
            {session ? (
                <>
                    <p>Email: {session.email}</p>
                    <button onClick={handleUpdateEmail}>Update Email</button>
                    <button onClick={handleLogout}>Logout</button>
                </>
            ) : (
                <button onClick={handleLogin}>Login</button>
            )}
        </div>
    );
}
```

### Example 5: Optimized with Selector

```typescript
function UserEmail() {
    // Only re-renders when email changes
    const [email] = useOnyx('session', {
        selector: (session) => session?.email ?? 'Not logged in'
    });

    return <div>Email: {email}</div>;
}
```

## Trade-offs

### Advantages ✅

1. **Intuitive API**: Mutate state like regular JavaScript objects
2. **Less boilerplate**: No `set()` or `merge()` calls needed
3. **Automatic change detection**: Proxy traps handle everything
4. **Deep reactivity**: Nested mutations tracked automatically
5. **Immutable snapshots**: React components get frozen copies (safe)
6. **Familiar pattern**: Similar to Valtio, MobX

### Disadvantages ⚠️

1. **Proxy overhead**: Slight performance cost for trap interceptions
2. **Not widely used pattern**: Less common than Redux/Zustand style
3. **Debugging**: Harder to trace mutations (no explicit calls)
4. **Learning curve**: Developers need to understand proxies
5. **Synchronous feel, async reality**: Mutations are sync, but persistence is async
6. **Global notifications**: All subscribers notified on any mutation (mitigated by selectors)

### When to Use ProxyBased

✅ **Good for:**
- Apps where state mutations are frequent and granular
- Teams comfortable with Valtio/MobX patterns
- Apps where developer experience is prioritized
- Prototyping and rapid development
- Apps with deeply nested state

❌ **Less ideal for:**
- Teams that prefer explicit state changes
- Apps that need full Redux DevTools integration
- Apps where every state change needs to be logged
- Performance-critical apps (use StoreBased for collections)

## Performance Characteristics

### Proxy Overhead

**Proxy traps add ~10-20% overhead:**

```typescript
// Regular object mutation: ~1ms
obj.value = 123;

// Proxied object mutation: ~1.1-1.2ms
proxyObj.value = 123;  // Calls set trap
```

**Usually negligible unless:**
- Mutating thousands of properties per frame
- In tight performance-critical loops

### Snapshot Caching

Snapshots are cached and only recreated when the proxy version changes:

```typescript
// First call: creates snapshot
const snap1 = snapshot(state);  // ~5ms

// Second call: returns cached
const snap2 = snapshot(state);  // ~0.01ms (cache hit!)

// After mutation: recreates
state.value = 123;
const snap3 = snapshot(state);  // ~5ms (version changed)
```

### Memory Usage

- **Proxy cache**: One proxy per object/array in state
- **Snapshot cache**: One frozen copy per object (cleared on mutation)
- **Version tracking**: One number per object

**Memory formula:**
```
Memory = (Regular state size) + (Proxy overhead) + (Snapshot cache)
       ≈ State size × 2-3
```

## Similar Libraries

### Valtio

ProxyBased is heavily inspired by [Valtio](https://github.com/pmndrs/valtio):

```typescript
// Valtio
import { proxy, useSnapshot } from 'valtio';

const state = proxy({ count: 0 });
state.count++;  // Direct mutation

function Counter() {
    const snap = useSnapshot(state);
    return <div>{snap.count}</div>;
}

// ProxyBased Onyx
import Onyx from './Onyx';
import useOnyx from './useOnyx';

await Onyx.init();
Onyx.state.count = 0;
Onyx.state.count++;  // Direct mutation

function Counter() {
    const [count] = useOnyx('count');
    return <div>{count}</div>;
}
```

### MobX

Similar to MobX observables but simpler:

```typescript
// MobX
import { makeObservable, observable, action } from 'mobx';
import { observer } from 'mobx-react';

class Store {
    count = 0;

    constructor() {
        makeObservable(this, {
            count: observable,
            increment: action,
        });
    }

    increment() {
        this.count++;
    }
}

// ProxyBased (simpler)
Onyx.state.count = 0;
Onyx.state.count++;  // No decorator needed!
```

## File Structure

```
prototypes/ProxyBased/
├── types.ts              # TypeScript type definitions
├── Storage.ts            # Storage layer (individual keys)
├── ReactiveSystem.ts     # Proxy-based reactivity (inspired by Valtio)
│   ├── proxy()          # Create reactive proxy
│   ├── snapshot()       # Create immutable snapshot
│   ├── subscribe()      # Subscribe to changes
│   └── getVersion()     # Change tracking
├── Onyx.ts              # Main API with proxy state
├── useOnyx.ts           # React hook (returns snapshots)
└── README.md            # This file
```

## Migration from KeyBased

### Before (KeyBased)

```typescript
// Set data
await Onyx.set('session', { userId: '123' });

// Merge
await Onyx.merge('session', { email: 'new@example.com' });

// Update nested
const session = await Onyx.get('session');
await Onyx.set('session', {
    ...session,
    preferences: {
        ...session.preferences,
        theme: 'dark',
    },
});
```

### After (ProxyBased)

```typescript
// Set data (direct mutation)
Onyx.state.session = { userId: '123' };

// Merge (direct mutation)
Onyx.state.session.email = 'new@example.com';

// Update nested (direct mutation)
Onyx.state.session.preferences.theme = 'dark';

// Much simpler!
```

## Next Steps

1. Understand the ReactiveSystem.ts implementation
2. Try direct mutations vs compatibility API
3. Compare performance with KeyBased for your use case
4. Consider hybrid approach (ProxyBased for UI state, StoreBased for collections)

## Notes

- This is a prototype exploring proxy-based reactivity patterns
- For production, consider:
  - Batch persistence to reduce storage writes
  - DevTools integration for debugging mutations
  - Performance profiling for your specific use case
  - Hybrid approach (proxy for UI, store for collections)
- The Storage layer uses in-memory storage by default
- Mutations are synchronous, but persistence is async in background
- Direct mutation API is recommended, but compatibility methods available
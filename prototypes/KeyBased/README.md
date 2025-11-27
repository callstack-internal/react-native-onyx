# Simplified Key-Based Onyx Implementation

This is a simplified prototype implementation of Onyx, focusing on the core key-based storage and subscription patterns.

## Architecture Overview

### Core Components

1. **Storage** (`Storage.ts`)
   - Persistent storage layer using in-memory storage (easily swappable with IndexedDB, AsyncStorage, etc.)
   - Provides async methods: `getItem()`, `setItem()`, `removeItem()`, `getAllKeys()`, `clear()`

2. **Cache** (`Cache.ts`)
   - In-memory cache with LRU (Least Recently Used) eviction
   - Provides fast synchronous access to frequently used data
   - Configurable max size to prevent memory issues

3. **ConnectionManager** (`ConnectionManager.ts`)
   - Manages subscriptions to Onyx keys
   - Follows the pattern from OnyxConnectionManager
   - Supports connection reuse and session management
   - Handles both regular keys and collection keys

4. **Onyx API** (`Onyx.ts`)
   - Main public API for interacting with the storage system
   - Methods: `init()`, `get()`, `set()`, `merge()`, `connect()`, `disconnect()`
   - Coordinates between Storage, Cache, and ConnectionManager

5. **useOnyx Hook** (`useOnyx.ts`)
   - React hook for subscribing to Onyx data
   - Uses `useSyncExternalStore` for optimal React integration
   - Supports selectors for subscribing to subsets of data
   - Provides loading states

## Key Concepts

### Keys

- **Regular Keys**: Simple string keys like `'session'`, `'userSettings'`
- **Collection Keys**: Keys ending with `'_'` like `'report_'`, `'policy_'`
- **Collection Members**: Individual items in a collection like `'report_123'`, `'report_456'`

### Storage Pattern

```
Storage (Persistent) <-> Cache (Memory) <-> Subscribers (React/Non-React)
```

1. Data is written to both Cache and Storage
2. Reads check Cache first, then Storage
3. Subscribers are notified when data changes

### Subscription Pattern

```typescript
// Non-React: Use Onyx.connect()
const connection = Onyx.connect({
    key: 'session',
    callback: (value) => {
        console.log('Session changed:', value);
    },
});

// Later...
Onyx.disconnect(connection);

// React: Use useOnyx()
function MyComponent() {
    const [session, metadata] = useOnyx('session');

    return <div>{session?.email}</div>;
}
```

## API Reference

### Onyx API

#### `init(options)`
Initialize the Onyx system.

```typescript
await Onyx.init({
    maxCachedKeysCount: 1000, // Optional, default 1000
});
```

#### `set(key, value)`
Set a value in storage.

```typescript
await Onyx.set('session', {
    userId: '123',
    email: 'user@example.com',
});
```

#### `get(key)`
Get a value from storage.

```typescript
const session = await Onyx.get('session');
```

#### `merge(key, changes)`
Merge changes with existing data.

```typescript
// For objects: shallow merge
await Onyx.merge('userSettings', { theme: 'dark' });

// For arrays/primitives: replaces the value
await Onyx.merge('tags', ['new', 'tags']);
```

#### `mergeCollection(collectionKey, collection)`
Merge multiple collection members at once.

```typescript
await Onyx.mergeCollection('report_', {
    'report_001': { title: 'Updated Report 1' },
    'report_002': { title: 'New Report 2' },
});
```

#### `remove(key)`
Remove a key from storage.

```typescript
await Onyx.remove('session');
```

#### `clear()`
Clear all data from storage.

```typescript
await Onyx.clear();
```

#### `connect(options)`
Subscribe to changes (non-React).

```typescript
const connection = Onyx.connect({
    key: 'session',
    callback: (value, key) => {
        console.log('Changed:', value);
    },
});
```

#### `disconnect(connection)`
Unsubscribe from changes.

```typescript
Onyx.disconnect(connection);
```

### useOnyx Hook

```typescript
function useOnyx<TValue, TReturnValue>(
    key: string,
    options?: {
        selector?: (data: TValue | null) => TReturnValue;
        initWithStoredValues?: boolean;
    }
): [TReturnValue | null, { status: 'loading' | 'loaded' }]
```

#### Basic Usage

```typescript
function SessionDisplay() {
    const [session, metadata] = useOnyx('session');

    if (metadata.status === 'loading') {
        return <div>Loading...</div>;
    }

    return <div>{session?.email}</div>;
}
```

#### With Selector

```typescript
function UserEmail() {
    // Only re-render when email changes
    const [email] = useOnyx('session', {
        selector: (session) => session?.email ?? 'Not logged in',
    });

    return <div>Email: {email}</div>;
}
```

## Examples

### Example 1: Session Management

```typescript
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
    description: 'Sales report for Q1',
});

await Onyx.set('report_002', {
    id: '002',
    title: 'Q2 Report',
    description: 'Sales report for Q2',
});

// Bulk update
await Onyx.mergeCollection('report_', {
    'report_001': { title: 'Updated Q1 Report' },
    'report_003': {
        id: '003',
        title: 'Q3 Report',
        description: 'Sales report for Q3',
    },
});

// Subscribe to collection changes
const connection = Onyx.connect({
    key: 'report_',
    callback: (value, key) => {
        console.log(`Report changed at ${key}:`, value);
    },
});
```

### Example 3: React Component with Actions

```typescript
function SessionManager() {
    const [session] = useOnyx('session');

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

## Performance Features

### Cache with LRU Eviction

The cache automatically evicts least recently used items when it reaches the max size:

```typescript
await Onyx.init({ maxCachedKeysCount: 100 });
```

### Selector Optimization

Using selectors prevents unnecessary re-renders:

```typescript
// Without selector: re-renders on ANY session change
const [session] = useOnyx('session');

// With selector: only re-renders when email changes
const [email] = useOnyx('session', {
    selector: (session) => session?.email,
});
```

### Connection Reuse

The ConnectionManager reuses connections when possible, reducing memory overhead and improving performance.

## Differences from Full Onyx

This simplified version focuses on core functionality:

**Included:**
- ✅ Key-based storage
- ✅ Cache with LRU eviction
- ✅ Subscription pattern
- ✅ Collections
- ✅ useOnyx hook with selectors
- ✅ Connection management

**Simplified/Omitted:**
- ❌ DevTools integration
- ❌ Performance metrics
- ❌ Multi-instance sync
- ❌ Eviction allow/block lists
- ❌ Migration handling
- ❌ withOnyx HOC (deprecated)
- ❌ Complex merge strategies
- ❌ Batch operations queue
- ❌ Deep merge for nested objects

## File Structure

```
prototypes/KeyBased/
├── types.ts              # TypeScript type definitions
├── Storage.ts            # Persistent storage layer
├── Cache.ts              # In-memory cache with LRU
├── ConnectionManager.ts  # Subscription management
├── Onyx.ts              # Main API
├── useOnyx.ts           # React hook
└── README.md            # This file
```

## Next Steps

To use this prototype:

1. Customize the Storage provider for your platform (web/native)
2. Add any missing features you need
3. Test performance with your data patterns

## Notes

- This is a prototype for understanding Onyx architecture
- For production use, refer to the full Onyx implementation
- The Storage layer uses in-memory storage by default (data doesn't persist across page reloads)
- To add real persistence, replace the MemoryStorage with IndexedDB, AsyncStorage, or SQLite
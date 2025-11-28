# ProxyBased Onyx

A proxy-based implementation inspired by Valtio. Uses JavaScript Proxies for automatic change detection with direct mutation support.

## Key Features

- **Direct mutation**: Mutate `Onyx.state` directly, no `set()` or `merge()` needed
- **Automatic reactivity**: Proxy traps detect mutations and notify subscribers
- **Immutable snapshots**: React components receive frozen copies for safety
- **Deep reactivity**: Nested object mutations tracked automatically
- **Global subscription**: All listeners subscribe to proxy state changes

## Architecture

```
Components
    ↓
Reactive System
  - Proxy state (mutable)
  - Snapshot cache (immutable)
  - Global listeners: Set<Listener>
  - Auto-notification on mutations
    ↓
Storage (individual keys)
```

## Usage

```typescript
// Direct mutation (preferred)
Onyx.state.session = { userId: '123', email: 'user@example.com' };
Onyx.state.session.email = 'new@example.com';

// Compatibility API (optional)
await Onyx.set('session', { userId: '123' });
await Onyx.merge('session', { email: 'new@example.com' });

// React hook
function SessionDisplay() {
    const [session] = useOnyx('session');
    return <div>{session?.email}</div>;
}
```

## Implementation

- **ReactiveSystem.ts**: Proxy-based reactivity (proxy, snapshot, subscribe)
- **Onyx.ts**: API layer with mutable `state` object
- **useOnyx.ts**: React hook using `useSyncExternalStore`
- **types.ts**: Type definitions
- **Storage.ts**: Storage layer (individual keys)

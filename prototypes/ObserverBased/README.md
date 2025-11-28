# ObserverBased Onyx

An observable-based implementation inspired by Legend-state. Components subscribe to observables, not raw keys, providing fine-grained reactivity.

## Key Features

- **Observable objects**: Values wrapped in Observable objects with `.get()`, `.set()`, `.subscribe()` methods
- **Fine-grained reactivity**: Components subscribe to specific observables, not all state changes
- **Per-observable notification**: Only subscribers of a changed observable are notified
- **Flexible API**: Use observables directly or convenience methods (`Onyx.set`, `Onyx.merge`)

## Architecture

```
Components
    ↓
Observable Registry
  - Map<key, Observable>
  - Each Observable has its own listeners: Set<Listener>
  - Observable.set() → notifies only its listeners
    ↓
Storage (individual keys)
```

## Usage

```typescript
// Direct observable usage
const sessionObservable = Onyx.observe('session');
await sessionObservable.set({ userId: '123', email: 'user@example.com' });
const unsubscribe = sessionObservable.subscribe((value) => console.log(value));

// Convenience API
await Onyx.set('session', { userId: '123' });
await Onyx.merge('session', { email: 'new@example.com' });

// React hook
function SessionDisplay() {
    const [session] = useOnyx('session');
    return <div>{session?.email}</div>;
}
```

## Implementation

- **ObservableSystem.ts**: Observable class and registry (Map<key, Observable>)
- **Onyx.ts**: API layer with `observe()` and convenience methods
- **useOnyx.ts**: React hook using `useSyncExternalStore`
- **types.ts**: Type definitions including Observable interface
- **Storage.ts**: Storage layer

## Notes

- Each Observable maintains its own listener set (per-observable notification)
- Only subscribers of a changed observable are notified (maximum efficiency)
- Observables are lazily created on first access via `Onyx.observe(key)`
- Inspired by Legend-state's observable pattern

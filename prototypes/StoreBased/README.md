# StoreBased Onyx

A global store implementation inspired by Zustand. All state lives in a single store, and all listeners subscribe to the entire store.

## Key Features

- **Single store**: All state in one global object
- **Global subscription**: All listeners subscribe to the entire store
- **React optimization**: `useSyncExternalStore` handles re-render prevention
- **Simple notification**: Just iterate through one set of listeners

## Architecture

```
Components
    ↓
OnyxStore (Single global store)
  - state: { all data }
  - listeners: Set<Listener>
  - notifyListeners(): void
    ↓
Storage
```

## Implementation

- **OnyxStore.ts**: Core store with single listener set
- **useOnyx.ts**: React hook using `useSyncExternalStore`
- **Onyx.ts**: API layer
- **types.ts**: Type definitions
- **Storage.ts**: Storage layer
- **Cache.ts**: Optional cache

## Notes

- All listeners subscribe to the entire store
- React's `useSyncExternalStore` optimizes re-renders automatically
- Use selectors to extract specific data
- Efficient for concentrated workloads (many components reading same keys)

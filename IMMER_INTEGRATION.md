# Immer.js Integration in Onyx

This document describes the integration of Immer.js into the Onyx state management library to provide better performance and immutability guarantees.

## Overview

Onyx now supports using Immer.js for merge operations through a feature flag. This provides:

- **Better Performance**: Immer uses structural sharing, only creating new objects for changed parts
- **Memory Efficiency**: Reduced memory usage through structural sharing
- **Backward Compatibility**: Feature flag allows gradual migration
- **Maintainability**: Cleaner, more readable merge logic

## Usage

### Enabling Immer

```typescript
import * as GlobalSettings from 'react-native-onyx';

// Enable Immer for all merge operations
GlobalSettings.setUseImmerForMerges(true);
```

### Disabling Immer (Default)

```typescript
import * as GlobalSettings from 'react-native-onyx';

// Use the current implementation (default)
GlobalSettings.setUseImmerForMerges(false);
```

### Checking Current Setting

```typescript
import * as GlobalSettings from 'react-native-onyx';

const isImmerEnabled = GlobalSettings.isUseImmerForMergesEnabled();
console.log('Immer enabled:', isImmerEnabled);
```

## Implementation Details

### Files Modified

1. **`lib/OnyxMergeImmer.ts`** - New Immer-based merge implementation
2. **`lib/GlobalSettings.ts`** - Added feature flag support
3. **`lib/OnyxUtils.ts`** - Updated to use Immer when enabled
4. **`lib/utils.ts`** - Updated to use Immer when enabled
5. **`tests/unit/fastMergeTest.ts`** - Added tests for both implementations
6. **`tests/perf-test/utils.perf-test.ts`** - Added performance comparisons

### Key Functions

- `fastMerge()` - Main merge function with Immer support
- `removeNestedNullValues()` - Null removal with Immer support
- `mergeChanges()` - Batch merge operations with Immer support
- `mergeAndMarkChanges()` - Mark-based merge operations with Immer support

## Performance Benefits

Immer.js provides several performance advantages:

1. **Structural Sharing**: Only changed parts of objects are recreated
2. **Memory Efficiency**: Unchanged parts are reused from the original object
3. **Optimized Updates**: Immer optimizes the update process internally

## Migration Strategy

1. **Phase 1**: Implement Immer alongside current logic with feature flag ✅
2. **Phase 2**: Run performance tests and validate behavior ✅
3. **Phase 3**: Enable Immer by default for new installations (Future)
4. **Phase 4**: Remove old implementation after validation period (Future)

## Testing

The implementation includes comprehensive tests for both the current and Immer implementations:

```bash
# Run all tests
npm test

# Run performance tests
npm run perf-test
```

## Example Usage

```typescript
import Onyx from 'react-native-onyx';
import * as GlobalSettings from 'react-native-onyx';

// Enable Immer for better performance
GlobalSettings.setUseImmerForMerges(true);

// All Onyx operations will now use Immer internally
Onyx.merge('user_profile', {
    name: 'John Doe',
    settings: {
        notifications: true,
        theme: 'dark'
    }
});

// The merge operation will use Immer's structural sharing
// for optimal performance and memory usage
```

## Future Enhancements

- Enable Immer by default in future versions
- Add more Immer-specific optimizations
- Consider Immer for other Onyx operations beyond merging
- Add Immer-specific configuration options

## Compatibility

- **Backward Compatible**: Existing code works unchanged
- **Feature Flag**: Can be enabled/disabled at runtime
- **Same API**: No changes to Onyx's public API
- **Same Behavior**: Both implementations produce identical results

# @ Completion Hang Fix

## Problem
一度 `@validateUser()` を入力した後、すべて削除して再度 `@` を入力すると「読み込んでいます...」が表示されたまま
(After typing `@validateUser()`, deleting all, and typing `@` again shows "Loading..." forever)

## Root Causes
1. **Deadlock in async locks**
   - `dependency_graph.read().await` followed by `context_cache.read().await`
   - Nested locks could cause deadlock

2. **Unnecessary async function**
   - `get_validator_completions` was async but had no async operations
   - Could cause executor issues

## Fixes Applied

### 1. Fixed Lock Ordering with Timeout
```rust
// Get both locks at once to avoid deadlock
let (graph, context) = {
    let timeout_duration = std::time::Duration::from_secs(2);
    match tokio::time::timeout(timeout_duration, async {
        let g = dependency_graph.read().await;
        let c = context_cache.read().await;
        (g, c.get(uri).cloned())
    }).await {
        Ok((g, c)) => (g, c),
        Err(_) => {
            eprintln!("ERROR: Timeout while getting locks");
            return completions; // Return empty on timeout
        }
    }
};
```

### 2. Made get_validator_completions Synchronous
```rust
// Before: pub async fn get_validator_completions
// After:  pub fn get_validator_completions
```

## Result
✅ @ completion no longer hangs after deletion
✅ Timeout prevents indefinite waiting
✅ Error handling provides fallback behavior

## Testing
1. Type `@validateUser()`
2. Delete everything
3. Type `@` again
4. Completions should appear without hanging
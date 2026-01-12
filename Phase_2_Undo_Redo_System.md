# Phase 2: Undo/Redo System Integration (Senior Developer Upgrade)

## 1. Deep Analysis & Risk Assessment
- **Core Requirement**: Transactional State Management for text edits.
- **Complexity Analysis**:
    - **State Granularity**: Saving full cell content on every character press is O(N^2) memory/perf disaster. We need "Debounced Snapshots".
    - **Selection Restoration**: Undoing text moves the cursor to the end. Users expect the cursor to return to where it was *when editing stopped*.
    - **Memory Leaks**: Unlimited stacks will crash the browser on long sessions.

## 2. Architectural Design
- **Command Pattern with Memento**:
    - `Command`: `execute()`, `undo()`, `redo()`.
    - `Memento`: `{ text: string, selection: { start, end }, timestamp: number }`.
- **Transaction Manager**:
    - **Debounce**: Group rapid typing (e.g., < 500ms intervals) into a single "Typing Transaction".
    - **Stack Limiter**: Max 50-100 items. Oldest items are garbage collected.
- **Selection Proxy**: Wrapper around `Selection` API to serialize/deserialize caret ranges relative to the edited cell.

## 3. Implementation Plan
- **File**: `src/lib/vanilla/features/history-manager-v2.js`
- **Key Logic**:
    ```javascript
    execute(command) {
        // Garbage Collect if size > MAX_STACK
        if (this.undoStack.length > this.maxStackSize) this.undoStack.shift();
        
        // Push State
        this.undoStack.push(command);
        this.redoStack = []; // Clear redo on new action
    }
    ```
- **DOM Integration**:
    - **Undo**: `element.innerHTML = oldData; restoreSelection(oldSelection);`
    - **Redo**: `element.innerHTML = newData; restoreSelection(newSelection);`
    - **Safety**: Use `requestAnimationFrame` for DOM updates to ensure layout is ready before setting cursor.

## 4. Senior Review / Edge Cases
- **Q**: What happens to Undo Stack if I navigate away and come back?
    - **A**: Stack persists in memory (Session based). If checking out a different file, stack must be cleared.
- **Q**: Handling "Destructive" external changes (e.g., API update)?
    - **A**: External updates should flush the stack or mark a checkpoint to prevent undoing into an invalid state.

## 5. Verification & Stress Test
- **Selection Fidelity**: Type "ABC", move cursor to "A|BC", type "D". Undo. Cursor should be at "A|BC", not "ABC|".
- **Memory Profile**: Perform 1000 edits. Check heap snapshot. Ensure no detached DOM nodes or zombie strings.
- **Concurrency**: Fast `Ctrl+Z` / `Ctrl+Y` cycling. Verify state doesn't get desynchronized (race conditions).

## 6. Fix / Refinement
- **Current Status**: Basic function storage.
- **Required Upgrade**: Implement `maxStackSize` (e.g., 50) and simple selection restorative logic (save `offset` relative to cell start).

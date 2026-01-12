# Phase 4: Dynamic Page Splitting (Auto-Pagination) (Senior Developer Upgrade)

## 1. Deep Analysis & Risk Assessment
- **Core Requirement**: WYSIWYG Pagination (Flowable Layout).
- **Complexity Analysis**:
    - **Layout Thrashing**: Measuring `scrollHeight` forces reflow. Doing this on every keystroke causes UI lag (jank).
    - **Infinite Loops**: If a single atomic element (e.g., an image) is taller than the page, the logic might try to split indefinitely.
    - **Table Splitting**: Splitting a table row is mathematically complex (merging cells, borders).

## 2. Architectural Design
- **Optimization Strategy**:
    - **Debounce**: Check pagination only after user stops typing (e.g., 500ms debounce).
    - **Dirty Flags**: Only check pages marked "Dirty" (edited).
- **Splitting Algorithm**:
    - **Atomic Check**: If element > Page Height, allow overflow (warn user) OR scale down. Do NOT split endlessly.
    - **Table Logic**: Currently partial-row splitting is dangerous. **Strategy**: Move *entire row* to next page if it doesn't fit.
    - **Reference Preservation**: When moving elements to New Page, ensure they retain their data binding (`_section`, `id`).

## 3. Implementation Plan
- **File**: `src/lib/vanilla/core/renderer.js`
- **Key Logic**:
    ```javascript
    checkPagination(pageDiv) {
        if (this.isPaginating) return; // Lock to prevent recursion
        this.isPaginating = true;
        
        try {
            // ... calculation ...
            if (newPageCreated) this.totalPages++;
        } finally {
            this.isPaginating = false; // Release lock
        }
    }
    ```
- **Loop Guard**:
    - Counter `retryCount`. If > 3 attempts to split same page fail, Abort and Log Error.

## 4. Senior Review / Edge Cases
- **Q**: What happens to text selection during a split?
    - **A**: Moving nodes destroys selection ranges. Logic must save cursor position (Node Path + Offset) and restore it after DOM manipulation.
- **Q**: Performance on 100-page document?
    - **A**: Pagination check must be local (O(1)), affecting only current + next page. Rippling effects (pushed content causing next page to overflow) should be handled via a "Pagination Queue" processed asynchronously.

## 5. Verification & Stress Test
- **Jank Test**: Type fast at the bottom of a page. Monitor FPS. Must stay > 30 FPS.
- **Table Boundary**: Create a row with huge height. Ensure it moves to next page cleanly without breaking table borders.
- **Selection Persistence**: Type character that causes split. Ensure focus remains in the editor (on the new page).

## 6. Fix / Refinement
- **Current Status**: Recursive check implemented.
- **Required Upgrade**: Add `isPaginating` Semaphore (Lock) and `Debounce` to `onChange` handler to prevent performance degradation.

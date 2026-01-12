# Phase 1: Advanced Text Input Strategy (Senior Developer Upgrade)

## 1. Deep Analysis & Risk Assessment
- **Core Requirement**: Support `Shift + Enter` for soft line breaks within HWPX paragraphs structures.
- **Complexity Analysis**: 
    - **IME Composition**: Korean text input uses composition events (`compositionstart`, `compositionend`). Naive key handlers often duplicate characters or break composition when modifying DOM during typing.
    - **DOM Integrity**: Inserting `<br>` can fragment text nodes. We must ensure the underlying data model (`paragraph.runs`) stays 1:1 consistent with the visual DOM.
    - **Paste Hazards**: Users may paste HTML with inline styles. We need a "Paste Sanitizer" to strip non-compliant styles and convert block elements to HWPX-compatible breaks.

## 2. Architectural Design
- **Event Pipeline**: `Keydown (Trap)` -> `IME Check` -> `Command Execution` -> `DOM Update` -> `Model Sync`.
- **Normalization**: All line breaks will be normalized to `<br class="hwpx-break">` for easy querying.
- **Sanitization Layer**: A `MutationObserver` or `Paste` handler that intercepts rich text and downgrades it to plain text + breaks.

## 3. Implementation Plan
- **File**: `src/lib/vanilla/features/inline-editor.js`
- **Key Logic**:
    ```javascript
    _handleKeydown(e) {
        // 1. IME Guard: Ignore events during composition (Korean/Japanese)
        if (e.isComposing || e.keyCode === 229) return;
        
        // 2. Shift+Enter Trap
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            this._insertSafeNewline(); // Uses strict Range manipulation
        }
    }
    ```
- **Robust Model Sync**:
    - Instead of simple `split('\n')`, use a **Tokenizer** approach:
        1. Walk DOM child nodes.
        2. Text Node -> Push Text Run.
        3. BR Node -> Push Break Run (or Split Paragraph).
        4. Validation -> Ensure no empty runs unless it's a blank line.
    - **Optimization**: Use `documentFragment` for batch DOM updates if splitting typically results in many nodes.

## 4. Senior Review / Edge Cases
- **Q**: What if `Shift+Enter` is pressed at the very start or very end of a cell?
    - **A**: Ensure logic handles "Empty Text Node" before or after the break.
- **Q**: Does this respect HWPX `LineSpacing`?
    - **A**: Yes, the renderer applies line-height. Splitting into new paragraphs duplicates the `ParaShape`, preserving line spacing headers.

## 5. Verification & Stress Test
- **IME Test**: Type "한글" (in progress) -> `Shift+Enter`. Verify no char duplication.
- **Rapid Fire**: Hold `Shift+Enter`. Verify performant cursor movement and memory stability.
- **Paste Test**: Copy text from Word/Web. Paste. Verify no foreign CSS classes pollute the cell.

## 6. Fix / Refinement
- **Current Status**: Code implements basic `Shift+Enter`.
- **Required Upgrade**: Add `isComposing` check to keydown handler to prevent "double-enter" issues on some browsers/OS combinations.

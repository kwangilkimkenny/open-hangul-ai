# HWPX Viewer Upgrade - Detailed Implementation Plan

## Goal Description
Perform a comprehensive upgrade of the HWPX viewer to support advanced editing (multi-line input, undo/redo), file compatibility (Hancom 2018), and dynamic auto-pagination. This plan breaks down the development into atomic, verifiable steps.

## User Review Required
> [!IMPORTANT]
> **Detailed Schedule Breakdown**
> - **Total Estimate**: 7-8 Working Days
> - **Phase 1: Advanced Text Input** (Days 1-2)
> - **Phase 2: Undo/Redo System** (Days 2-3)
> - **Phase 3: File Compatibility** (Days 4-5)
> - **Phase 4: Dynamic Pagination** (Days 6-7)
> - **Phase 5: Final Integration & QA** (Day 8)

---

## Phase 1: Advanced Text Input Strategy
**Core Objective**: Implement robust newline handling (`Shift + Enter` and `Enter`) within the InlineEditor without breaking existing styles.

### 1.1 Key Event Handling ([inline-editor.js](file:///Users/kimkwangil/Documents/project_03/hanview-react-app-v3/src/lib/vanilla/features/inline-editor.js))
- [ ] **Capture Keydown**: In `_handleKeydown`, explicitly trap `Enter` key.
- [ ] **Differentiate Modifier**: Check `e.shiftKey`.
    - If `true` (Shift+Enter): Prevent default, `stopPropagation`, call internal newline inserter.
    - If `false` (Enter): Prevent default, `stopPropagation`, call `saveChanges()` and navigate to next cell.

### 1.2 Newline Insertion Logic
- [ ] **DOM Manipulation**: Implement `_insertNewlineAtCursor()`:
    - Get current Selection and Range.
    - Create a `<br>` element (visual newline).
    - Insert `<br>` at range start.
    - Move cursor *after* the inserted `<br>` using `range.setStartAfter()`.
    - Scroll the caret into view (`scrollIntoView`).

### 1.3 Data Model Synchronization
- [ ] **Text Splitting**: In `_updateCellData(data, text)`:
    - Split `text` by `\n` character.
- [ ] **Paragraph Generation**:
    - Iterate through split lines.
    - Create a new Paragraph object for each line.
    - **Crucial**: Copy `paraShapeId` and `styleId` from the *original* paragraph to *all* new paragraphs to maintain indentation/alignment.
    - Create a Run object for text.
    - **Crucial**: Copy `charShapeId` from the *original* run to the new run to maintain font/size/color.

---

## Phase 2: Undo/Redo System Integration
**Core Objective**: Make text editing transactional and reversible.

### 2.1 History Manager Setup ([history-manager-v2.js](file:///Users/kimkwangil/Documents/project_03/hanview-react-app-v3/src/lib/vanilla/features/history-manager-v2.js))
- [ ] **Validation**: Ensure `HistoryManagerV2` is initialized in `viewer.js` and accessible via `this.viewer.historyManager`.
- [ ] **Interface Check**: Confirm `execute(doAction, undoAction, name)` pattern is ready.

### 2.2 Transactional Editing ([inline-editor.js](file:///Users/kimkwangil/Documents/project_03/hanview-react-app-v3/src/lib/vanilla/features/inline-editor.js))
- [ ] **Snapshotting**: Before saving changes, capture:
    - `oldText` (content before edit).
    - `newText` (content after edit).
    - `targetData` (reference to the cell/paragraph data object).
- [ ] **Command Execution**:
    - Replace direct `_updateCellData` call with `historyManager.execute()`.
    - **Do Action**: `_updateCellData(targetData, newText)` + trigger callbacks/autosave.
    - **Undo Action**: `_updateCellData(targetData, oldText)` + DOM update (restore innerText/HTML to reflect undo visually if active).

### 2.3 Keyboard Shortcuts
- [ ] **Undo**: Capture `Ctrl+Z` (or `Cmd+Z`) -> call `historyManager.undo()`.
- [ ] **Redo**: Capture `Ctrl+Shift+Z` / `Ctrl+Y` -> call `historyManager.redo()`.

---

## Phase 3: File Compatibility Improvement
**Core Objective**: Ensure exported `.hwpx` files open correctly in legacy viewers (Hancom 2018).

### 3.1 Version Control ([json-to-xml.js](file:///Users/kimkwangil/Documents/project_03/hanview-react-app-v3/src/lib/vanilla/export/json-to-xml.js))
- [ ] **Downgrade Version**: Change default version in `generateVersionXml` from `2.8` to `1.0`.
    - Rationale: Legacy viewers may reject higher version numbers or strict schema validation of newer specific elements.

### 3.2 XML Structure Validation
- [ ] **Safe Attribute Generation**:
    - In `generateTableXml`, ensure `InstId`, `Width`, `Height` have valid default values (avoid `0` where illegal).
    - In `generateParagraphXml`, ensure `ParaShape` and `Style` attributes default to `0` if undefined (never null/empty).
- [ ] **Escaping**: Verify `escapeXml` properly handles special characters (`<`, `>`, `&`, `"`) to prevent XML parsing errors.

---

## Phase 4: Dynamic Page Splitting (Auto-Pagination)
**Core Objective**: Real-time pagination when content expands beyond page boundaries.

### 4.1 Renderer Logic Enhancement ([renderer.js](file:///Users/kimkwangil/Documents/project_03/hanview-react-app-v3/src/lib/vanilla/core/renderer.js))
- [ ] **Section Association**: Modify `createPageContainer` to attach the `_section` data object to the DOM element property. This allows retrieval of section data (margins, header/footer info) directly from the page `div`.
- [ ] **Public Pagination Method**: Implement `checkPagination(pageDiv)`:
    - Retrieve `_section` from `pageDiv`.
    - Call existing (but internal) `autoPaginateContent`.
    - If new pages are created, update `totalPages` count.
    - Return `true` if pagination occurred.

### 4.2 Event Wiring ([viewer.js](file:///Users/kimkwangil/Documents/project_03/hanview-react-app-v3/src/lib/vanilla/viewer.js))
- [ ] **Listener Attachment**:
    - In `_enableEditingFeatures` (or init), listen to `InlineEditor.onChange`.
- [ ] **Trigger Logic**:
    - When text changes, find the `closest('.hwp-page-container')`.
    - Call `renderer.checkPagination(pageDiv)`.
- [ ] **Optimization (Optional)**: Debounce this call if performance lags (e.g., check only every 500ms or on blur). *Start with immediate check for responsiveness.*

---

## Verification Plan

### Test Scenario A: Multi-line Input
1. **Action**: Click a table cell. Type "Line 1". Press `Shift+Enter`. Type "Line 2".
2. **Check**: Visually 2 lines. Cursor is at end of Line 2. `div` height expands.

### Test Scenario B: Undo/Redo
1. **Action**: Perform Scenario A. Press `Ctrl+Z`.
2. **Check**: Text reverts to "Line 1".
3. **Action**: Press `Ctrl+Y`.
4. **Check**: Text returns to "Line 1\nLine 2".

### Test Scenario C: Pagination
1. **Action**: Go to bottom of page. Add lines until overflow.
2. **Check**: A new page appears immediately below. Content moves to new page.

### Test Scenario D: Export
1. **Action**: Export document.
2. **Check**: File size is reasonable. Unzip `.hwpx` to verify `version.xml` says `1.0`.

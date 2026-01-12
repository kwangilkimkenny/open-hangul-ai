# Live Feature Testing Guide

Dev server is running at: **http://localhost:5090/**

## 🧪 Manual Testing Checklist

### Phase 2: Undo/Redo System

#### Test 2.1: Basic Undo/Redo
1. Open the viewer at http://localhost:5090/
2. Make edits to a paragraph
3. Click Undo button (or Ctrl+Z)
   - ✅ Text should revert
4. Click Redo button (or Ctrl+Y)
   - ✅ Text should restore

#### Test 2.2: React Context Integration
1. Check that Undo/Redo buttons update their disabled state automatically
2. Hover over buttons to see tooltips with action names
   - ✅ Should show "실행 취소: [action name]" or "다시 실행: [action name]"

#### Test 2.3: Multiple Undo/Redo
1. Make 5-10 edits
2. Undo multiple times rapidly
   - ✅ Should handle smoothly without lag
3. Redo multiple times
   - ✅ Should restore all changes in order

### Phase 3: Page Splitting & Auto-pagination

#### Test 3.1: Automatic Page Split
1. Add a long paragraph at the end of a page
2. Keep typing until content exceeds page height
   - ✅ New page should be created automatically
   - ✅ Content should flow to next page

#### Test 3.2: Table Splitting
1. Insert a large table (20+ rows)
   - ✅ Table should split across multiple pages
   - ✅ Headers should repeat on each page

#### Test 3.3: Margin Collapse
1. Create multiple paragraphs with spacing
   - ✅ Spacing should be accurate (no excessive gaps)
   - ✅ Page breaks should occur at logical points

### Phase 4: Dynamic Pagination Performance

#### Test 4.1: Typing Performance
1. Type rapidly in a paragraph near page boundary
   - ✅ No lag or jank (should maintain >30 FPS)
   - ✅ Pagination should be debounced (not on every keystroke)

#### Test 4.2: Debug Mode
1. Open browser console
2. Type: `window.viewer.renderer.enablePaginationDebug()`
3. Check pages for debug overlays
   - ✅ Should show clientHeight, scrollHeight, overflow status
4. Type: `window.viewer.renderer.disablePaginationDebug()`
   - ✅ Overlays should disappear

#### Test 4.3: Dirty Pages
1. Edit multiple pages
2. Check console for "marked dirty" messages
   - ✅ Only edited pages should be marked dirty

### Phase 5: Error Handling & Integration

#### Test 5.1: Undo + Pagination Cascade
1. Type text that causes page split
2. Undo the change
   - ✅ Page should merge back
3. Redo the change
   - ✅ Page should split again
   - ✅ No errors in console

#### Test 5.2: Error Recovery
1. Open browser DevTools Console
2. Check for any errors
   - ✅ No unhandled errors
   - ✅ All errors should be caught and logged gracefully

#### Test 5.3: Memory Management
1. Edit for 5-10 minutes continuously
2. Open browser DevTools Memory tab
3. Take a heap snapshot
   - ✅ Memory should not grow unbounded
   - ✅ WeakMap should allow GC of old elements

## 🎯 Key Features to Verify

### Performance Metrics
- [ ] **Undo/Redo**: <100ms response time
- [ ] **Typing**: No lag, smooth at >30 FPS
- [ ] **Pagination**: Debounced (500ms delay)
- [ ] **Memory**: No leaks after extended editing

### Functionality
- [ ] **Undo/Redo buttons**: Update disabled state automatically
- [ ] **Page splitting**: Automatic when content exceeds height
- [ ] **Table splitting**: Splits by rows with header repetition
- [ ] **Error handling**: No crashes, all errors logged

### User Experience
- [ ] **Smooth typing**: No pagination jank
- [ ] **Visual feedback**: Undo/Redo tooltips show action names
- [ ] **Debug mode**: Visual overlays available
- [ ] **Stability**: No crashes during extended use

## 🐛 Common Issues to Check

1. **Undo/Redo disabled?**
   - Check if HistoryContext Provider is wrapping the component
   - Verify useHistory() hook is being called

2. **Page split not working?**
   - Check console for recursion limit messages
   - Verify enableAutoPagination is true

3. **Performance issues?**
   - Check if debouncing is enabled
   - Verify pagination queue is processing correctly

4. **Errors in console?**
   - All errors should be caught by error boundaries
   - Check error-boundary.js is imported

## 📊 Browser Console Commands

```javascript
// Enable debug mode
window.viewer.renderer.enablePaginationDebug()

// Disable debug mode
window.viewer.renderer.disablePaginationDebug()

// Check history stats
window.viewer.historyManager.getStats()

// Get history
window.viewer.historyManager.getHistory()

// Check dirty pages
console.log(window.viewer.renderer.dirtyPages)

// Check pagination queue
console.log(window.viewer.renderer.paginationQueue)

// Generate logging report
import { generateLoggingReport } from './src/lib/vanilla/utils/logging-validator.js'
console.log(generateLoggingReport())
```

## ✅ Expected Results

After all phases are complete, you should see:

1. **Phase 2**: Smooth undo/redo with React integration
2. **Phase 3**: Intelligent page splitting with table support
3. **Phase 4**: High-performance pagination with no lag
4. **Phase 5**: Robust error handling with no crashes

All features should work together seamlessly with no conflicts or performance degradation.

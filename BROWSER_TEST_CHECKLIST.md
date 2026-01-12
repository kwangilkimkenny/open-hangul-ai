# 🌐 Browser Testing Checklist - Phase 2-5 Features

**Dev Server:** http://localhost:5090/

---

## 🔴 **CRITICAL: Test These First**

### ✅ Test 1: Basic Load
**Expected:** Application loads without errors
- [ ] Open http://localhost:5090/
- [ ] Check browser console (F12) - Should be clean, no red errors
- [ ] Page renders correctly

### ✅ Test 2: File Loading
**Expected:** Can load HWPX file
- [ ] Drag and drop a HWPX file OR click to select
- [ ] Document renders correctly
- [ ] Pages are visible

---

## 🟡 **PHASE 2: Undo/Redo Testing**

### ✅ Test 2.1: Basic Undo/Redo (P0)
**Expected:** Smooth undo/redo operations

**Steps:**
1. Click on a table cell to edit
2. Type some text (e.g., "Hello World")
3. Press **Ctrl+Z** (Undo)
   - ✅ **Expected:** Text disappears
   - ✅ **Expected:** Response time <100ms
4. Press **Ctrl+Y** (Redo)
   - ✅ **Expected:** Text reappears
   - ✅ **Expected:** Response time <100ms

**Console Check:**
```javascript
// Check history stats
window.viewer?.historyManager?.getStats()
// Expected output:
// {
//   undoCount: 0 (after redo),
//   redoCount: 0,
//   canUndo: false,
//   canRedo: false,
//   lastAction: "..."
// }
```

### ✅ Test 2.2: Multiple Edits (P0)
**Expected:** Can undo/redo multiple operations

**Steps:**
1. Make 5 different edits in different cells
2. Press **Ctrl+Z** 3 times
   - ✅ **Expected:** Each undo reverts one edit
3. Press **Ctrl+Y** 2 times
   - ✅ **Expected:** Each redo restores one edit

### ✅ Test 2.3: React Context Integration (P3)
**Expected:** Undo/Redo buttons update automatically

**Steps:**
1. Look for Undo/Redo buttons in the UI
2. When history is empty:
   - ✅ **Expected:** Undo button is disabled (grayed out)
   - ✅ **Expected:** Redo button is disabled
3. Make an edit
   - ✅ **Expected:** Undo button becomes enabled
4. Hover over Undo button
   - ✅ **Expected:** Tooltip shows "실행 취소: [action name]"

### ✅ Test 2.4: Memory Management (P1)
**Expected:** No memory leaks during long session

**Steps:**
1. Open DevTools → Performance tab
2. Take a heap snapshot (Memory tab)
3. Make 20-30 edits, then undo all
4. Take another heap snapshot
   - ✅ **Expected:** Memory should not grow unbounded
   - ✅ **Expected:** Old element states should be garbage collected

**Console Check:**
```javascript
// This will show if WeakMap is working
// Old elements should be GC'd automatically
console.log("WeakMap allows automatic garbage collection")
```

---

## 🟢 **PHASE 3: Pagination Testing**

### ✅ Test 3.1: Automatic Page Split
**Expected:** New page created when content exceeds height

**Steps:**
1. Scroll to the last page of the document
2. Click on the last paragraph
3. Type a lot of text (keep typing until you exceed page height)
   - ✅ **Expected:** A new page is automatically created
   - ✅ **Expected:** Content flows to the new page
   - ✅ **Expected:** No infinite loop (stops after creating page)

### ✅ Test 3.2: Table Splitting
**Expected:** Large tables split across pages with headers

**Steps:**
1. If document has a large table (20+ rows):
   - ✅ **Expected:** Table is split across multiple pages
   - ✅ **Expected:** Table header repeats on each page
2. If no large table, add rows to an existing table:
   - Right-click → "Insert Row Below" (repeat many times)
   - ✅ **Expected:** Table eventually splits to new page

### ✅ Test 3.3: Recursion Prevention
**Expected:** No infinite loops during pagination

**Console Check:**
```javascript
// Check if recursion limit is in place
// This should be logged if near limit:
// "Pagination recursion limit reached (depth: 10)"
```

**Steps:**
1. Try to create a scenario that would trigger deep recursion
2. Check console for recursion limit messages
   - ✅ **Expected:** Should stop at depth 10
   - ✅ **Expected:** No browser freeze

---

## 🔵 **PHASE 4: Performance Testing**

### ✅ Test 4.1: Typing Performance
**Expected:** Smooth typing with no lag

**Steps:**
1. Click on a paragraph near the bottom of a page
2. Type rapidly (as fast as you can type)
   - ✅ **Expected:** No lag or jank
   - ✅ **Expected:** Smooth typing experience
   - ✅ **Expected:** FPS stays >30 (check with DevTools Performance)

**Performance Check:**
1. Open DevTools → Performance tab
2. Click "Record"
3. Type rapidly for 10 seconds
4. Stop recording
   - ✅ **Expected:** FPS graph shows >30 FPS consistently
   - ✅ **Expected:** No long tasks (yellow bars)

### ✅ Test 4.2: Debounced Pagination
**Expected:** Pagination doesn't trigger on every keystroke

**Console Check:**
```javascript
// Watch console while typing
// You should see debounced pagination messages
// NOT immediate pagination on every key
```

**Steps:**
1. Open console (F12)
2. Type continuously for 3 seconds
3. Stop typing and wait 1 second
   - ✅ **Expected:** Pagination check happens AFTER you stop typing
   - ✅ **Expected:** Not on every keystroke

### ✅ Test 4.3: Debug Mode
**Expected:** Visual overlays show page information

**Steps:**
1. Open browser console (F12)
2. Type:
```javascript
window.viewer.renderer.enablePaginationDebug()
```
3. Look at each page
   - ✅ **Expected:** Red overlay box appears on top-right of each page
   - ✅ **Expected:** Shows: Client height, Scroll height, Overflow, Status
4. Disable debug mode:
```javascript
window.viewer.renderer.disablePaginationDebug()
```
   - ✅ **Expected:** Overlays disappear

### ✅ Test 4.4: Dirty Flags
**Expected:** Only edited pages are re-paginated

**Console Check:**
```javascript
// Check dirty pages
console.log(window.viewer.renderer.dirtyPages)
// Should show Set of page numbers that were edited
```

**Steps:**
1. Edit content on page 2
2. Check console - page 2 should be marked dirty
3. Edit content on page 5
4. Check console - page 5 should be marked dirty
   - ✅ **Expected:** Only edited pages are in the dirty set

### ✅ Test 4.5: Pagination Queue
**Expected:** Multiple pagination requests are queued

**Console Check:**
```javascript
// Check pagination queue
console.log(window.viewer.renderer.paginationQueue)
// Should show array of queued pages
```

---

## 🟣 **PHASE 5: Error Handling & Integration**

### ✅ Test 5.1: Undo + Pagination Cascade
**Expected:** Undo/Redo works with pagination

**Steps:**
1. Type text that causes a page split (new page created)
2. Press **Ctrl+Z** (Undo)
   - ✅ **Expected:** Text is removed
   - ✅ **Expected:** Extra page is removed (page merges back)
3. Press **Ctrl+Y** (Redo)
   - ✅ **Expected:** Text is restored
   - ✅ **Expected:** Page splits again
4. Check console
   - ✅ **Expected:** No errors

### ✅ Test 5.2: Error Recovery
**Expected:** No crashes, errors are caught gracefully

**Steps:**
1. Open console (F12)
2. Try various operations:
   - Rapid clicking
   - Multiple undos/redos
   - Editing while pagination is happening
3. Check console continuously
   - ✅ **Expected:** No unhandled errors (red messages)
   - ✅ **Expected:** All errors caught by error boundaries
   - ✅ **Expected:** Graceful error messages (if any)

### ✅ Test 5.3: Long Session Test
**Expected:** Stable performance over time

**Steps:**
1. Edit document for 5-10 minutes continuously
2. Make 50+ edits (add text, delete, undo, redo)
3. Check browser task manager (Shift+Esc in Chrome)
   - ✅ **Expected:** Memory usage is stable (not constantly growing)
   - ✅ **Expected:** No memory leaks

---

## 🎯 **Advanced Console Tests**

Open browser console (F12) and run these commands:

### Check History Manager Status
```javascript
// Get full history stats
const stats = window.viewer.historyManager.getStats()
console.log('History Stats:', stats)

// Get undo/redo lists
const history = window.viewer.historyManager.getHistory()
console.log('Undo Stack:', history.undoList)
console.log('Redo Stack:', history.redoList)
```

### Check Renderer Status
```javascript
// Check pagination state
console.log('Is Paginating:', window.viewer.renderer.isPaginating)
console.log('Pagination Queue:', window.viewer.renderer.paginationQueue)
console.log('Dirty Pages:', window.viewer.renderer.dirtyPages)
console.log('Total Pages:', window.viewer.renderer.totalPages)
```

### Enable All Debug Features
```javascript
// Enable pagination debug
window.viewer.renderer.enablePaginationDebug()

// Check all dirty pages
window.viewer.renderer.checkAllDirtyPages()

// Log everything
console.log('Full Viewer State:', {
    historyManager: window.viewer.historyManager.getStats(),
    renderer: {
        isPaginating: window.viewer.renderer.isPaginating,
        queueLength: window.viewer.renderer.paginationQueue.length,
        dirtyPages: Array.from(window.viewer.renderer.dirtyPages),
        totalPages: window.viewer.renderer.totalPages
    }
})
```

---

## 📊 **Performance Expectations**

| Metric | Target | How to Check |
|--------|--------|--------------|
| **Undo/Redo Speed** | <100ms | Feel the response |
| **Typing FPS** | >30 FPS | DevTools Performance |
| **Page Split** | <200ms | Visual observation |
| **Memory Growth** | Stable | Task Manager |
| **Console Errors** | 0 | Console tab |

---

## ✅ **Success Criteria**

### Must Pass (Critical)
- [ ] Application loads without errors
- [ ] Undo/Redo works smoothly (<100ms)
- [ ] Page splitting happens automatically
- [ ] No console errors during normal use
- [ ] No browser freeze or crash

### Should Pass (Important)
- [ ] Undo/Redo buttons update state automatically
- [ ] Table splitting works with headers
- [ ] Typing is smooth (>30 FPS)
- [ ] Pagination is debounced
- [ ] Debug mode shows overlays

### Nice to Have (Optional)
- [ ] Memory is stable over long session
- [ ] Dirty flags track edited pages
- [ ] Error messages are user-friendly

---

## 🚨 **If Something Goes Wrong**

### Issue: Console shows errors
**Fix:** Check error-boundary.js is loaded
```javascript
// Should return function
console.log(typeof window.viewer.renderer.enablePaginationDebug)
```

### Issue: Undo/Redo not working
**Fix:** Check HistoryManager is initialized
```javascript
// Should return object with stats
console.log(window.viewer.historyManager.getStats())
```

### Issue: Pagination not happening
**Fix:** Check enableAutoPagination option
```javascript
// Should be true
console.log(window.viewer.renderer.options.enableAutoPagination)
```

### Issue: Performance is slow
**Fix:** Check pagination queue isn't stuck
```javascript
// Should be empty or small number
console.log(window.viewer.renderer.paginationQueue.length)
```

---

## 📝 **Test Results Template**

Copy this and fill it out:

```
# Browser Test Results - Phase 2-5

Date: ___________
Browser: ___________
OS: ___________

## Phase 2: Undo/Redo
- [ ] Basic undo/redo: PASS / FAIL
- [ ] Multiple edits: PASS / FAIL
- [ ] React buttons: PASS / FAIL
- [ ] Memory management: PASS / FAIL

## Phase 3: Pagination
- [ ] Auto page split: PASS / FAIL
- [ ] Table splitting: PASS / FAIL
- [ ] Recursion limit: PASS / FAIL

## Phase 4: Performance
- [ ] Typing speed: PASS / FAIL (___FPS)
- [ ] Debounced pagination: PASS / FAIL
- [ ] Debug mode: PASS / FAIL
- [ ] Dirty flags: PASS / FAIL

## Phase 5: Integration
- [ ] Undo+Pagination: PASS / FAIL
- [ ] Error handling: PASS / FAIL
- [ ] Long session: PASS / FAIL

## Console Errors: ___________

## Notes:
___________________________________________
```

---

## 🎉 **Ready to Test!**

1. Open: http://localhost:5090/
2. Open DevTools: F12 (Console tab)
3. Follow checklist above
4. Report any issues found

**Good luck testing!** 🚀

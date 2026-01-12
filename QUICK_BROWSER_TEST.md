# 🧪 Quick Browser Test Guide

**URL:** http://localhost:5090/

**Test Time:** 5-10 minutes

---

## 🚀 Quick Start Testing

### 1. Open Developer Console (F12)
- Press **F12** (or Cmd+Option+I on Mac)
- Go to **Console** tab
- Watch for errors (should be minimal)

### 2. Load a HWPX File
- **Option A:** Drag and drop a HWPX file onto the page
- **Option B:** Click "파일 열기" button to select a file
- ✅ **Expected:** Document loads and renders

---

## ✅ Phase 2-5 Quick Tests (5 minutes)

### Test 1: Basic Undo/Redo (1 min) ⚡ MOST IMPORTANT

**Steps:**
1. Click on any text or table cell
2. Type some text (e.g., "Test 123")
3. Press **Ctrl+Z** (Cmd+Z on Mac)
4. Press **Ctrl+Y** (Cmd+Shift+Z on Mac)

**✅ Expected:**
- Undo: Text disappears instantly (<100ms)
- Redo: Text reappears instantly
- No lag or freeze

**Console Check:**
```javascript
window.viewer?.historyManager?.getStats()
// Should show: { canUndo: true/false, canRedo: true/false, ... }
```

---

### Test 2: Page Splitting (2 min)

**Steps:**
1. Scroll to the last page
2. Click on the last paragraph
3. Keep typing until you fill the page
4. Continue typing past the bottom

**✅ Expected:**
- New page automatically created
- Content flows to new page
- No browser freeze

**Console Check:**
```javascript
console.log('Total Pages:', window.viewer.renderer.totalPages)
// Should increase by 1
```

---

### Test 3: Typing Performance (1 min)

**Steps:**
1. Click on a paragraph
2. Type rapidly for 10 seconds (as fast as you can)

**✅ Expected:**
- No lag while typing
- Smooth, responsive input
- No stuttering

**Performance Check:**
1. Open DevTools → Performance tab
2. Click Record
3. Type rapidly for 10 seconds
4. Stop recording
5. Check FPS graph (should be >30 FPS)

---

### Test 4: Debug Mode (30 sec)

**Console Command:**
```javascript
window.viewer.renderer.enablePaginationDebug()
```

**✅ Expected:**
- Red overlay boxes appear on each page
- Shows: Client height, Scroll height, Overflow, Status

**Disable:**
```javascript
window.viewer.renderer.disablePaginationDebug()
```

---

### Test 5: Undo + Pagination Cascade (1 min)

**Steps:**
1. Type text until a new page splits
2. Press **Ctrl+Z** (Undo)
3. Press **Ctrl+Y** (Redo)

**✅ Expected:**
- Undo: Text removed AND page merges back
- Redo: Text restored AND page splits again
- Smooth transitions

---

## 🔍 Console Commands Reference

### Check System Status
```javascript
// Full status check
console.log('╔═══════════════════════════════════════╗')
console.log('║     SYSTEM STATUS CHECK               ║')
console.log('╚═══════════════════════════════════════╝')

console.log('\n📊 History Manager:')
console.log(window.viewer.historyManager.getStats())

console.log('\n📄 Renderer:')
console.log({
    totalPages: window.viewer.renderer.totalPages,
    isPaginating: window.viewer.renderer.isPaginating,
    queueLength: window.viewer.renderer.paginationQueue.length,
    dirtyPages: Array.from(window.viewer.renderer.dirtyPages)
})
```

### Performance Benchmark
```javascript
// Test undo/redo performance
console.log('⚡ Running performance benchmark...')

// Make 100 test edits
for (let i = 0; i < 100; i++) {
    window.viewer.historyManager.execute(
        () => { window.testData = i },
        () => { window.testData = i - 1 },
        `Test ${i}`
    )
}

// Benchmark undo
const start = performance.now()
for (let i = 0; i < 100; i++) {
    window.viewer.historyManager.undo()
}
const time = performance.now() - start

console.log('✅ Benchmark Results:')
console.log(`   100 undos: ${time.toFixed(2)}ms`)
console.log(`   Average: ${(time / 100).toFixed(3)}ms per undo`)
console.log(`   Target: <1ms per undo`)
console.log(`   Status: ${time / 100 < 1 ? '✅ PASS' : '❌ FAIL'}`)
```

### Enable All Debug Features
```javascript
window.viewer.renderer.enablePaginationDebug()
console.log('🐛 Debug mode enabled!')
console.log('Look for red overlays on each page')
```

---

## ❌ What to Look For (Errors)

### Console Errors
- ❌ Red error messages
- ❌ Unhandled promise rejections
- ❌ React errors
- ⚠️ Yellow warnings are OK (informational)

### Performance Issues
- ❌ Lag while typing
- ❌ Freezing or stuttering
- ❌ Slow undo/redo (>100ms)

### UI Issues
- ❌ Text not appearing
- ❌ Pages not splitting
- ❌ Undo not working

---

## ✅ Success Criteria

### Must Pass:
- [x] Application loads without errors
- [x] Undo/Redo works instantly (<100ms)
- [x] Page splitting happens automatically
- [x] No console errors during normal use
- [x] Typing is smooth (no lag)

### Should Pass:
- [x] Performance benchmark <1ms per operation
- [x] Debug mode shows overlays
- [x] Undo+Pagination cascade works
- [x] No memory leaks (stable over time)

---

## 📊 Expected Results

Based on Phase 2-5 implementation, you should see:

| Feature | Expected Behavior |
|---------|------------------|
| **Undo/Redo** | <1ms response time |
| **Typing FPS** | >30 FPS maintained |
| **Page Split** | Automatic, smooth |
| **Memory** | Stable (WeakMap GC) |
| **Console** | Clean (no red errors) |

---

## 🐛 Troubleshooting

### Issue: Undo/Redo not working
```javascript
// Check if history manager exists
console.log(window.viewer?.historyManager)
// Should return an object
```

### Issue: No pages splitting
```javascript
// Check auto-pagination setting
console.log(window.viewer.renderer.options.enableAutoPagination)
// Should be true
```

### Issue: Performance slow
```javascript
// Check pagination queue
console.log(window.viewer.renderer.paginationQueue.length)
// Should be 0 or small number
```

### Issue: Console errors
- Check browser console for specific error messages
- Most TypeScript errors won't affect runtime
- JavaScript runtime errors need investigation

---

## 📝 Report Template

After testing, report results:

```
Browser Test Results - v2.1.0
Date: _______
Browser: _______

✅ PASSED:
- [ ] Application loads
- [ ] Undo/Redo works (<100ms)
- [ ] Page splitting works
- [ ] Typing performance good (>30 FPS)
- [ ] No console errors
- [ ] Debug mode works
- [ ] Undo+Pagination cascade works

❌ FAILED:
- List any issues found

Console Errors: _______
Performance: _______
Notes: _______
```

---

## 🎯 Priority Tests

**If you only have 2 minutes, test these:**

1. **Undo/Redo** - Type something, press Ctrl+Z, Ctrl+Y
2. **Console Check** - Press F12, check for red errors
3. **Typing** - Type rapidly, check for lag

These 3 tests cover 80% of critical functionality.

---

**Happy Testing!** 🚀

For detailed testing: See `BROWSER_TEST_CHECKLIST.md`
For deployment: See `DOCKER_DEPLOYMENT_INSTRUCTIONS.md`

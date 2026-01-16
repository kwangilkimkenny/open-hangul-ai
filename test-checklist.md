# Cross-Browser Testing Checklist

# Quick Reference for Manual Testing

**Test URL:** http://localhost:5090/ **Version:** 2.1.0 **Date:** 2026-01-16

---

## Quick Start

1. Open your browser
2. Navigate to http://localhost:5090/
3. Open DevTools (F12)
4. Follow the checklist below

---

## Browser Information

**Fill this out before starting:**

```
Browser Name: _________________
Browser Version: _________________
Operating System: _________________
Screen Resolution: _________________
Testing Date: _________________
Tester Name: _________________
```

---

## 1. Initial Load Test (2 minutes)

### Page Load

- [ ] Page loads without errors
- [ ] Title shows "HAN-View React App"
- [ ] No console errors (red text)
- [ ] Loading animation displays (if any)

### Console Check

```
Expected: No errors
Look for: Red error messages, CSP violations
```

### Security Headers Check (DevTools → Network → First request → Headers)

- [ ] Content-Security-Policy present
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] X-XSS-Protection present

### Performance Check

- [ ] Page loads in < 3 seconds
- [ ] No layout shifts (content jumping)
- [ ] Smooth scrolling

---

## 2. HWPX File Loading Test (3 minutes)

### Test File: simple.hwpx

- [ ] Click "Load HWPX" / "파일 선택" button
- [ ] Select test file (test-files/simple.hwpx)
- [ ] File upload progress shows (if implemented)
- [ ] Document loads successfully

### Verify Rendering

- [ ] Paragraphs display correctly
- [ ] Korean/English text readable
- [ ] Formatting preserved (bold, italic, etc.)
- [ ] No missing content
- [ ] No console errors

### Console Messages

```
Expected:
- "Parsing HWPX file..."
- "Document loaded successfully"

Not Expected:
- "Failed to parse..."
- "Error loading..."
```

---

## 3. Document Display Test (2 minutes)

### Text Rendering

- [ ] Korean characters display correctly (한글)
- [ ] English text displays correctly
- [ ] Special characters display (©, ®, ™, etc.)
- [ ] Font sizes consistent
- [ ] Line spacing correct

### Layout Rendering

- [ ] Paragraphs properly spaced
- [ ] Margins correct
- [ ] No overlapping text
- [ ] Alignment correct (left/center/right)

### Images (if present)

- [ ] Images display correctly
- [ ] Image proportions correct
- [ ] No broken images
- [ ] Images load from Blob URLs

### Tables (if present)

- [ ] Table borders display
- [ ] Cell content visible
- [ ] Column widths correct
- [ ] Row heights correct

---

## 4. Inline Editing Test (3 minutes)

### Enter Edit Mode

- [ ] Click on a paragraph
- [ ] Paragraph becomes editable (cursor appears)
- [ ] Border/highlight appears around paragraph
- [ ] Existing text remains visible

### Edit Content

- [ ] Type new text
- [ ] Korean input works (한글 입력)
- [ ] English input works
- [ ] Delete text works (Backspace)
- [ ] Copy/paste works (Ctrl+C, Ctrl+V)

### Save Changes

- [ ] Click outside paragraph OR press Enter
- [ ] Edit mode exits
- [ ] Changes saved and visible
- [ ] No console errors

### Cancel Changes

- [ ] Enter edit mode again
- [ ] Press Escape key
- [ ] Edit mode exits
- [ ] Original text restored (if implemented)

---

## 5. Table Editing Test (3 minutes)

### If document has tables:

### Cell Editing

- [ ] Click on table cell
- [ ] Cell becomes editable
- [ ] Type new content
- [ ] Click outside to save
- [ ] Changes persist

### Add Row

- [ ] Click "Add Row" button
- [ ] New row appears at bottom
- [ ] New row has correct number of cells
- [ ] Table structure maintained

### Add Column

- [ ] Click "Add Column" button
- [ ] New column appears at right
- [ ] New column has correct number of cells
- [ ] Table structure maintained

### Delete Operations (if implemented)

- [ ] Delete row works
- [ ] Delete column works
- [ ] Table updates correctly

---

## 6. AI Features Test (Lazy Loading) (2 minutes)

### Trigger AI Features

- [ ] Click "Extract Template" OR "Save File" button
- [ ] Check Console for lazy loading message:
  ```
  "⚡ Lazy loading AI features..."
  "✅ AI features fully loaded and ready"
  ```

### Network Check (DevTools → Network)

- [ ] Filter by "JS"
- [ ] Look for `feature-ai-*.js` (77 KB)
- [ ] Verify chunk loads successfully (200 OK)
- [ ] Load time < 1 second on fast connection

### Functionality

- [ ] AI feature executes without errors
- [ ] Loading spinner displays during API call (if implemented)
- [ ] Result displays correctly
- [ ] No console errors

---

## 7. Image Editor Test (Lazy Loading) (2 minutes)

### Trigger Image Editor

- [ ] Click "Insert Image" button
- [ ] Check Console for lazy loading message:
  ```
  "⚡ Lazy loading ImageEditor..."
  "✅ ImageEditor initialized"
  ```

### Network Check

- [ ] Look for `feature-ui-editors-*.js` (9 KB)
- [ ] Verify chunk loads successfully

### Functionality

- [ ] Image upload dialog appears
- [ ] Select image file
- [ ] Image editor interface loads
- [ ] Insert image works
- [ ] No console errors

---

## 8. Export Test (2 minutes)

### Export PDF

- [ ] Click "Export PDF" button
- [ ] Export process starts
- [ ] PDF file downloads
- [ ] Filename correct (document-name.pdf)
- [ ] Open PDF - content correct

### Export HWPX

- [ ] Click "Export HWPX" button
- [ ] HWPX file downloads
- [ ] Filename correct (document-name.hwpx)
- [ ] Re-load exported file - content preserved

---

## 9. Security Test (2 minutes)

### CSP Violations

- [ ] Check Console for CSP violation errors
- [ ] Should be NO CSP violations
- [ ] All resources load from allowed sources

### Frame Embedding Test

Open DevTools Console and run:

```javascript
// This should fail (blocked by CSP)
const iframe = document.createElement('iframe');
iframe.src = 'https://example.com';
document.body.appendChild(iframe);
```

- [ ] Iframe blocked by CSP
- [ ] Console shows CSP violation

### External Script Test

Open DevTools Console and run:

```javascript
// This should fail (blocked by CSP)
const script = document.createElement('script');
script.src = 'https://evil.com/malicious.js';
document.body.appendChild(script);
```

- [ ] Script blocked by CSP
- [ ] Console shows CSP violation

---

## 10. Performance Test (3 minutes)

### Lighthouse Test (Chrome/Edge only)

1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Select "Performance" + "Accessibility"
4. Click "Analyze page load"

Expected Scores:

- [ ] Performance: 90+ (target: 95+)
- [ ] Accessibility: 90+ (target: 95+)
- [ ] Best Practices: 95+
- [ ] SEO: 95+

### Core Web Vitals

From Lighthouse report:

- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] FID (First Input Delay) < 100ms
- [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] FCP (First Contentful Paint) < 1.8s

### Bundle Size Check

Network tab → Bottom status bar:

- [ ] Initial load: ~450 KB (or less)
- [ ] Transferred (gzip): ~130 KB (or less)
- [ ] Resources: < 10 requests for initial load

---

## 11. Responsive Design Test (2 minutes)

### Desktop (1920x1080)

- [ ] Open DevTools (F12)
- [ ] Toggle device toolbar (Ctrl+Shift+M)
- [ ] Select "Responsive" mode
- [ ] Set width to 1920px
- [ ] Layout looks correct
- [ ] All buttons visible
- [ ] No horizontal scrollbar

### Tablet (768x1024)

- [ ] Set width to 768px
- [ ] Layout adapts to tablet size
- [ ] Content readable
- [ ] Navigation accessible
- [ ] Buttons properly sized

### Mobile (375x667)

- [ ] Set width to 375px
- [ ] Layout stacks vertically
- [ ] Text readable (not too small)
- [ ] Buttons touchable (44x44px minimum)
- [ ] No content cutoff

---

## 12. Accessibility Test (2 minutes)

### Keyboard Navigation

- [ ] Press Tab key repeatedly
- [ ] Focus moves through all interactive elements
- [ ] Focus indicator visible (blue outline)
- [ ] Focus order logical (top to bottom, left to right)
- [ ] Can reach all buttons/inputs
- [ ] Can exit all components (no keyboard traps)

### Keyboard Shortcuts

- [ ] Enter edit mode (click paragraph)
- [ ] Press Escape → Exits edit mode
- [ ] Press Enter in edit mode → Saves changes (if implemented)
- [ ] Press Tab → Moves to next element

### Color Contrast

- [ ] Text readable against background
- [ ] Buttons have sufficient contrast
- [ ] Links distinguishable
- [ ] Focus indicators visible

---

## 13. Error Handling Test (2 minutes)

### Invalid File Test

1. Create a text file and rename to `test.hwpx`
2. Try to load it

- [ ] Error message displays
- [ ] Error message clear and helpful
- [ ] App remains stable (no crash)
- [ ] Can still load valid file after error

### Large File Test (if available)

1. Load file > 20MB

- [ ] Progress indicator shows (if implemented)
- [ ] File loads successfully (may take time)
- [ ] App remains responsive
- [ ] No browser freezing

### Network Error Test (AI Features)

1. Disconnect internet
2. Click "Extract Template"

- [ ] Error message displays
- [ ] Error message mentions network issue
- [ ] App remains stable

---

## 14. Browser-Specific Tests

### Firefox-Specific

- [ ] Blob URLs work (images display)
- [ ] CSS Grid layout correct (tables)
- [ ] Dynamic import() works (lazy loading)
- [ ] contentEditable works smoothly

### Safari-Specific

- [ ] File API works (file upload)
- [ ] Large files load (if < 50MB)
- [ ] Dynamic import() not cached excessively
- [ ] Private browsing mode works

### Mobile-Specific

- [ ] Touch tap works (not double-tap zoom)
- [ ] Virtual keyboard doesn't cover content
- [ ] File picker accessible
- [ ] Pinch-to-zoom works
- [ ] Scroll smooth on touch

---

## Test Results Summary

### Overall Status

```
Browser: _______________
Version: _______________

Tests Passed: ____ / 60
Tests Failed: ____ / 60
Tests Skipped: ____ / 60

Pass Rate: _____%
```

### Critical Issues Found

```
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________
```

### Non-Critical Issues Found

```
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________
```

### Performance Metrics

```
Lighthouse Performance Score: ____
Initial Load Time: ____ seconds
LCP: ____ seconds
CLS: ____
```

### Recommendation

```
[ ] ✅ APPROVED - Ready for production
[ ] ⚠️ APPROVED WITH NOTES - Minor issues, can deploy
[ ] ❌ NOT APPROVED - Critical issues, needs fixes
```

---

## Notes

### Additional Observations

```
_______________________________________________
_______________________________________________
_______________________________________________
_______________________________________________
```

### Screenshots / Screen Recordings

```
Attach screenshots of any issues found
```

---

## Quick Command Reference

### DevTools Shortcuts

```
Windows/Linux:
- F12 or Ctrl+Shift+I: Open DevTools
- Ctrl+Shift+M: Toggle device toolbar
- Ctrl+Shift+C: Inspect element
- Ctrl+R: Reload page
- Ctrl+Shift+R: Hard reload (clear cache)

macOS:
- Cmd+Opt+I: Open DevTools
- Cmd+Opt+M: Toggle device toolbar
- Cmd+Opt+C: Inspect element
- Cmd+R: Reload page
- Cmd+Shift+R: Hard reload
```

### Console Commands

```javascript
// Check security headers
fetch(window.location.href).then(r => {
  console.log('CSP:', r.headers.get('Content-Security-Policy'));
  console.log('X-Frame-Options:', r.headers.get('X-Frame-Options'));
});

// Check bundle size
performance
  .getEntriesByType('resource')
  .reduce((total, r) => total + r.transferSize, 0) / 1024;
// Result in KB

// Check memory usage
performance.memory.usedJSHeapSize / 1048576;
// Result in MB
```

---

**Testing Time:** ~30 minutes total **Checklist Version:** 1.0 **Last Updated:**
2026-01-16

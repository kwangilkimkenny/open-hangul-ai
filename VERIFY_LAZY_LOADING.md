# 🔍 Verify Lazy Loading - Network Tab Guide

**Purpose:** Confirm that UI editors (ImageEditor, ShapeEditor) are lazy loaded on-demand

---

## 📋 Step-by-Step Verification

### Step 1: Open Browser DevTools
1. Navigate to: **http://localhost:8080**
2. Press **F12** (or Cmd+Option+I on Mac)
3. Click the **"Network"** tab
4. ✅ Check **"Disable cache"** checkbox (important!)

### Step 2: Initial Load Verification

**Action:** Refresh the page (Cmd+R / Ctrl+R)

**Expected Results:**

✅ **SHOULD Load (Initial Bundle):**
```
index-*.js                    (~18 KB)   - Main entry
vendor-react-*.js            (~197 KB)   - React library
core-viewer-*.js             (~218 KB)   - Core viewer
core-utils-*.js              (~7 KB)     - Utilities
lib-jszip-*.js               (~96 KB)    - JSZip library
feature-export-*.js          (~35 KB)    - Export features
feature-ai-*.js              (~76 KB)    - AI features
feature-ui-*.js              (~49 KB)    - UI components
index-*.css                  (~84 KB)    - Styles
```

❌ **SHOULD NOT Load:**
```
feature-ui-editors-*.js      (8.5 KB)    - UI Editors (LAZY!)
```

**Verification:**
- Type "feature-ui-editors" in Network tab filter
- **Result should be EMPTY** on initial load ✅

---

### Step 3: Trigger Lazy Loading

**Method A: Trigger via Console**

1. Open **Console** tab (next to Network)
2. Paste and run:
```javascript
// Get viewer instance
const viewer = window.viewer;

// Trigger ImageEditor lazy load
await viewer.loadImageEditor();
```

**Method B: Trigger via UI** (requires HWPX file loaded)

1. Load a HWPX document
2. Try to insert an image (if UI button available)
3. Or use console:
```javascript
await viewer.command.insertImage('test.jpg');
```

### Step 4: Verify Lazy Load in Network Tab

**Expected Results:**

After triggering, you should see in Network tab:
```
✅ feature-ui-editors-COlEQQCi.js     8.5 KB     200 OK
```

**Filter Tips:**
- Type "ui-editors" in filter box
- Or sort by "Time" column (newest at bottom)

---

## 🎯 What to Look For

### Initial Load (Page Refresh)

| File | Size | Status | Notes |
|------|------|--------|-------|
| index-*.js | ~18 KB | 200 | ✅ Main entry |
| vendor-react-*.js | ~197 KB | 200 | ✅ React |
| core-viewer-*.js | ~218 KB | 200 | ✅ Core |
| core-utils-*.js | ~7 KB | 200 | ✅ Utils |
| lib-jszip-*.js | ~96 KB | 200 | ✅ JSZip |
| feature-export-*.js | ~35 KB | 200 | ✅ Export |
| feature-ai-*.js | ~76 KB | 200 | ✅ AI |
| feature-ui-*.js | ~49 KB | 200 | ✅ UI |
| **feature-ui-editors-*.js** | **8.5 KB** | **-** | **❌ ABSENT** |

### After Triggering Image/Shape Edit

| File | Size | Status | Notes |
|------|------|--------|-------|
| **feature-ui-editors-*.js** | **8.5 KB** | **200** | **✅ NOW LOADED** |

---

## 📊 Network Tab Settings

**Recommended Settings:**
- ☑️ Disable cache
- ☑️ Show all network requests
- ☐ Hide data URLs (optional)
- Filter: "JS" or "All"

**Columns to Check:**
- Name (filename)
- Status (should be 200)
- Type (should be "script")
- Size (actual size)
- Time (load time)
- Waterfall (timing visualization)

---

## 🧪 Console Verification

While in Network tab, also check Console for messages:

**On Initial Load:**
```
✅ No lazy loading messages (UI editors not needed yet)
```

**After Triggering:**
```
⚡ Lazy loading ImageEditor...
✅ ImageEditor module imported
✅ ImageEditor initialized
```

---

## 🔬 Detailed Test Script

**Copy/paste this into Console to test lazy loading:**

```javascript
// Test Lazy Loading Verification Script
console.log('🔍 Starting Lazy Loading Verification...\n');

// Check if viewer exists
if (!window.viewer) {
    console.error('❌ Viewer not found. Load a HWPX file first.');
} else {
    console.log('✅ Viewer instance found');
    
    // Check initial state
    console.log('\n📊 Initial State:');
    console.log('ImageEditor loaded:', window.viewer._imageEditorLoaded);
    console.log('ShapeEditor loaded:', window.viewer._shapeEditorLoaded);
    
    // Trigger lazy load
    console.log('\n⚡ Triggering lazy load...');
    
    (async () => {
        try {
            // Load ImageEditor
            console.log('\n1️⃣ Loading ImageEditor...');
            await window.viewer.loadImageEditor();
            console.log('✅ ImageEditor loaded!');
            
            // Load ShapeEditor
            console.log('\n2️⃣ Loading ShapeEditor...');
            await window.viewer.loadShapeEditor();
            console.log('✅ ShapeEditor loaded!');
            
            // Check final state
            console.log('\n📊 Final State:');
            console.log('ImageEditor loaded:', window.viewer._imageEditorLoaded);
            console.log('ShapeEditor loaded:', window.viewer._shapeEditorLoaded);
            console.log('ImageEditor instance:', window.viewer.imageEditor ? '✅ Present' : '❌ Missing');
            console.log('ShapeEditor instance:', window.viewer.shapeEditor ? '✅ Present' : '❌ Missing');
            
            console.log('\n✅ Verification complete! Check Network tab for feature-ui-editors-*.js');
        } catch (error) {
            console.error('❌ Error during lazy load:', error);
        }
    })();
}
```

---

## 📸 Screenshots to Capture

### Before Lazy Load (Initial)
**Network Tab Filter: "feature-ui-editors"**
- Result: Empty (no files)
- Status: ✅ CORRECT

### After Lazy Load (Triggered)
**Network Tab Filter: "feature-ui-editors"**
- Result: `feature-ui-editors-COlEQQCi.js` (8.5 KB)
- Status: 200 OK
- Status: ✅ CORRECT

---

## ✅ Success Criteria

**Lazy Loading is WORKING if:**

1. ✅ Initial page load does NOT include `feature-ui-editors-*.js`
2. ✅ After triggering, `feature-ui-editors-*.js` appears in Network tab
3. ✅ File loads successfully (Status: 200)
4. ✅ Console shows lazy loading messages
5. ✅ Image/shape editing functionality works

**Lazy Loading is BROKEN if:**

1. ❌ `feature-ui-editors-*.js` appears on initial page load
2. ❌ File never loads when triggered
3. ❌ Status is not 200 (404, 500, etc.)
4. ❌ No console messages appear
5. ❌ Editing functionality doesn't work

---

## 🐛 Troubleshooting

### Issue: feature-ui-editors loads on initial page load

**Problem:** Not lazy loading, included in initial bundle

**Solutions:**
1. Check vite.config.ts - ensure ui-editors chunk is configured
2. Verify imports are dynamic: `import('./features/...')`
3. Rebuild: `npm run build`

### Issue: feature-ui-editors never loads

**Problem:** Lazy loading broken

**Solutions:**
1. Check console for errors
2. Verify file exists: `ls dist/assets/feature-ui-editors-*.js`
3. Check network for 404 errors
4. Verify dynamic import path is correct

### Issue: Multiple feature-ui-editors files load

**Problem:** Duplicate imports

**Solutions:**
1. Check if multiple triggers are firing
2. Verify loading state flags are working
3. Clear cache and reload

---

## 📋 Quick Checklist

- [ ] DevTools Network tab open
- [ ] "Disable cache" checked
- [ ] Page refreshed
- [ ] Initial load verified (no ui-editors)
- [ ] Lazy load triggered (console or UI)
- [ ] feature-ui-editors-*.js appears
- [ ] Status: 200 OK
- [ ] Console messages correct
- [ ] Functionality works

---

## 🎬 Video Tutorial Steps

**Recording Steps:**

1. **Start Recording**
   - Open http://localhost:8080
   - Open DevTools (F12)
   - Network tab
   - Check "Disable cache"

2. **Show Initial State**
   - Filter: "feature-ui-editors"
   - Result: Empty ✅

3. **Trigger Lazy Load**
   - Open Console
   - Run test script (above)
   - Switch back to Network tab

4. **Show Lazy Load**
   - Filter: "feature-ui-editors"
   - Result: File appears ✅
   - Status: 200 OK ✅

5. **Done!**
   - Lazy loading verified ✅

---

**Verification Status:** Ready for testing  
**URL:** http://localhost:8080  
**Build:** v2.1.0 (Optimized)

**Happy Testing!** 🎉

# Platform Testing Guide

## ✅ Dev Server Status

**Server:** Running at http://localhost:3000
**Status:** ✅ Ready
**Build:** Fresh restart with all fixes applied

---

## 🧪 TESTING CHECKLIST

### **1. File Upload Testing**

**Test Valid Uploads:**
- [ ] Upload a GLB file (3D model)
- [ ] Upload an STL file (3D mesh)
- [ ] Upload a PDF file (2D drawing)

**Test Validation:**
- [ ] Try uploading a file >500MB (should reject with clear error)
- [ ] Try uploading a file 100-500MB (should show warning but allow)
- [ ] Try uploading unsupported format like .txt (should reject)
- [ ] Upload file with special characters in name (should warn)

**Test Error Recovery:**
- [ ] Upload a file, then click "Clear" and upload another
- [ ] Upload same file twice (should create version 2)

**Expected Behavior:**
- ✅ Progress bar shows 0% → 100%
- ✅ States: validating → uploading → processing → success
- ✅ Redirects to viewer after success
- ✅ Clear error messages if something fails

---

### **2. 3D Viewer Testing**

**Basic Viewing:**
- [ ] Model loads and displays correctly
- [ ] Can rotate model (left-click + drag)
- [ ] Can pan model (right-click + drag)
- [ ] Can zoom in/out (mouse wheel)
- [ ] Model is centered in view
- [ ] Lighting looks good

**Performance:**
- [ ] Rotation is smooth (60 FPS)
- [ ] No lag when zooming
- [ ] No freezing or stuttering

**Error Handling:**
- [ ] If model fails to load, shows error UI (not blank screen)
- [ ] Can retry failed load

---

### **3. Annotation Testing**

**Adding Annotations:**
- [ ] Click "Comment" tool (💬 icon)
- [ ] Click on model surface
- [ ] Type a comment
- [ ] Press Ctrl+Enter to save (or click Save button)
- [ ] Annotation appears as numbered bubble

**Annotation Features:**
- [ ] Hover over bubble to see full text
- [ ] Click bubble to select annotation
- [ ] Annotations persist after page refresh
- [ ] Multiple annotations can be added

**Keyboard Shortcuts:**
- [ ] Press Escape to cancel annotation
- [ ] Press Ctrl+Enter to quick-save

---

### **4. Dimensioning/Measurement Testing**

**Creating Measurements:**
- [ ] Click "Measure" tool (📏 icon)
- [ ] Click first point on model
  - Should see yellow sphere
  - Should see green flash if snapped to vertex
- [ ] Click second point
  - Should see green flash if snapped to vertex
  - Dimension line appears
  - Distance shown in meters (3 decimals)

**Measurement Features:**
- [ ] Dimension line is visible (yellow)
- [ ] End points marked with spheres
- [ ] Distance label always faces camera
- [ ] Can create multiple measurements
- [ ] Measurements persist after refresh

**Precision:**
- [ ] Snapping works near corners/edges (green pulse)
- [ ] Distance shows 3 decimal places (mm accuracy)

---

### **5. Revision Cloud Testing**

**Adding Rev Clouds:**
- [ ] Click "Rev Cloud" tool (☁️ icon)
- [ ] Click on model surface
- [ ] Type issue description
- [ ] Save annotation
- [ ] Cloud appears as RED bubble (vs blue for comments)

**Features:**
- [ ] Red bubbles for rev clouds
- [ ] Blue bubbles for regular comments
- [ ] Both types work the same way

---

### **6. Tool Switching**

**Test All Tools:**
- [ ] Select tool (default - just navigate)
- [ ] Comment tool (add annotations)
- [ ] Rev Cloud tool (add issues)
- [ ] Measure tool (dimensions)

**Behavior:**
- [ ] Camera controls disabled during annotation
- [ ] Cursor changes based on active tool
- [ ] Can switch between tools freely

---

### **7. Export Testing**

**CSV Export:**
- [ ] Click "Export" button
- [ ] Select "CSV" format
- [ ] Click "Export as CSV"
- [ ] File downloads automatically
- [ ] Open CSV - should contain annotations and activity

**PDF Export:**
- [ ] Click "Export" button
- [ ] Select "PDF" format
- [ ] Click "Export as PDF"
- [ ] New window opens with print dialog
- [ ] Report shows file info, annotations, activity

---

### **8. Share Link Testing**

**Generate Share Link:**
- [ ] Click "Share" button
- [ ] Select access mode (Read-only or Comment-only)
- [ ] Set expiration (1-30 days or Never)
- [ ] Click "Generate Share Link"
- [ ] Link appears

**Use Share Link:**
- [ ] Copy link
- [ ] Open in incognito/private window
- [ ] Should see model without login
- [ ] Read-only: can only view
- [ ] Comment-only: can view and comment

---

### **9. Permission Testing**

**Admin User:**
- [ ] Can upload files
- [ ] Can delete files
- [ ] Can comment/annotate
- [ ] Can use all tools

**Reviewer User:**
- [ ] Cannot upload files
- [ ] Cannot delete files
- [ ] CAN comment/annotate
- [ ] Measure tool works

**Viewer User:**
- [ ] Cannot upload files
- [ ] Cannot delete files
- [ ] Cannot comment/annotate
- [ ] Can only view and measure

---

### **10. Error Scenarios**

**Test Robustness:**
- [ ] Disconnect internet during upload (should show error + retry)
- [ ] Try to upload without permission (should deny)
- [ ] Upload corrupted file (should show error)
- [ ] Click annotation while rotating (should prevent)
- [ ] Refresh page during annotation (should cancel)

---

## 🎯 KNOWN ISSUES FIXED

✅ **Infinite Re-render Loop** - FIXED
- Was causing "Too many re-renders" error
- Now uses standalone function instead of hook
- Smooth 60 FPS rendering

✅ **Upload Validation** - IMPROVED
- File size limits enforced
- File type validation
- Clear error messages
- Progress tracking

✅ **Error Handling** - ENHANCED
- Graceful fallback UI
- Retry mechanisms
- Clear user feedback

---

## 📊 EXPECTED PERFORMANCE

**Upload:**
- Small files (<10MB): < 5 seconds
- Medium files (10-100MB): 10-30 seconds
- Large files (100-500MB): 30-120 seconds

**Rendering:**
- Frame rate: 60 FPS
- Model load: 1-5 seconds
- Annotation add: Instant
- Measurement: Instant

**Interactions:**
- Rotation: Smooth, no lag
- Zoom: Responsive
- Pan: Fluid
- Tool switch: Instant

---

## 🐛 HOW TO REPORT ISSUES

If you find a bug:

1. **Note the exact steps** to reproduce
2. **Check browser console** (F12) for errors
3. **Take screenshot** if visual issue
4. **Note your role** (admin/reviewer/viewer)
5. **Note file type** (GLB/STL/PDF)

---

## ✅ SUCCESS CRITERIA

Platform is working correctly if:

- ✅ Can upload files without errors
- ✅ 3D models render smoothly
- ✅ Can add annotations and they persist
- ✅ Can create measurements with snapping
- ✅ Can export data (CSV/PDF)
- ✅ Can share files with links
- ✅ No console errors during normal use
- ✅ Smooth performance (60 FPS)

---

**Status:** Ready for Testing ✅
**Server:** http://localhost:3000
**Last Updated:** December 23, 2025

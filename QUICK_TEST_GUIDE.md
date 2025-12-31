# Quick Test Guide - Phase 1 Features

## ⚠️ First: Free Up Disk Space

Your disk is currently **100% full** (386MB available). You need to:
1. Delete unnecessary files to free up at least 5GB
2. Empty trash
3. Run: `rm -rf /Users/heathjansse/Desktop/wild/.next`
4. Run: `npm run dev`

---

## 🚀 Quick Test Workflow (5 minutes)

### Step 1: Import Sample CSV (2 min)

1. Start dev server: `npm run dev`
2. Open http://localhost:3000/items
3. Find "Import Square Vendor Sales CSV" section
4. Upload: `new-project/vendor-sales-2025-08-25-2025-08-31 (7).csv`
5. Click "Import"
6. ✅ **Expected:** See green success message showing updated items with new categories

### Step 2: Organize Items (2 min)

1. Click "📊 Organize Items" button (purple)
2. Select "Fridge & Freezer" from category dropdown
3. Drag an item by the ≡ handle
4. Move it up or down
5. Click "Save Order"
6. ✅ **Expected:** Success message, items stay in new order after refresh

### Step 3: Print Stock Check (1 min)

1. Click "🖨️ Print Stock Check" button (green)
2. Review the preview showing:
   - Blue category headers
   - Items grouped by category
   - Shelf locations
   - Empty rows for notes
3. Click "Print Sheet"
4. ✅ **Expected:** Browser print dialog opens with organized stock check sheet

---

## 🔍 Detailed Feature Testing

### Feature: Square CSV Auto-Categorization

**Test File:** `new-project/vendor-sales-2025-08-25-2025-08-31 (7).csv`

**What to check:**
- Items from "All Good Foods" vendor are updated
- Category "Fridge & Freezer" is assigned correctly
- Subcategory "Fridge" is suggested (based on keyword matching)
- Items like "Tempeh Organic" show updated categories

**Expected Results:**
```
Updated: 30 items
Created: 0 items (we only update existing items)
Skipped: Some (items not yet in database)
```

### Feature: Drag-and-Drop Reordering

**Steps:**
1. Go to `/items/organize`
2. Filter by "Cafe Food" category
3. Find "Byron Brownie" (if exists)
4. Drag it to position 1
5. Save Order
6. Refresh page
7. Verify it's still at position 1

**Expected Behavior:**
- Drag handle (≡) appears on hover
- Item follows cursor when dragging
- Drop zones highlight
- Order persists after save

### Feature: Category/Subcategory Editing

**Steps:**
1. In `/items/organize`
2. Click "Edit" on any item
3. Change subcategory to "Top Shelf"
4. Tab away (triggers save)
5. Modal closes automatically
6. Verify change in item list

**Expected Behavior:**
- Modal appears instantly
- Changes save on blur
- Blue badge shows new subcategory

### Feature: Print View with Category Grouping

**Steps:**
1. Go to `/items/print-preview`
2. Don't select a vendor (show all)
3. Scroll through preview

**What to check:**
- ✅ Blue headers for each category
- ✅ Items sorted by displayOrder within categories
- ✅ Subcategory column shows shelf locations
- ✅ Empty rows (3 per category) for handwritten notes
- ✅ "Checked By" and "Time" footer
- ✅ Print button works

**Test Print:**
1. Click "Print Sheet"
2. In print preview:
   - Check landscape orientation
   - Verify blue headers print in color
   - Check page breaks don't split categories
   - Ensure all columns fit on page

---

## 🐛 Common Issues & Solutions

### Issue: "No items found"
**Solution:** Import the Square CSV first to populate items with categories

### Issue: Drag-and-drop doesn't work
**Solution:**
- Check browser console for errors
- Ensure @dnd-kit installed: `npm install`
- Try different browser (Chrome recommended)

### Issue: Categories don't show on print
**Solution:**
- Check browser print settings
- Enable "Background graphics" in print dialog
- Use Chrome/Edge for best print support

### Issue: Import shows "Item does not exist" for many items
**Solution:** This is expected! The system only updates existing items. Items not in your database are skipped. To create new items:
1. Use the regular "Add Item" flow, or
2. Import invoice PDFs which create items automatically

---

## 📊 Sample Data

If you need more test data, you can:

1. **Add items manually:**
   - Click "➕ Add Item"
   - Enter name, category, pricing
   - Save

2. **Import an invoice:**
   - Go to Invoices section
   - Upload a PDF (see `new-project/United_Organics_2025-01-31_2104.52.pdf`)
   - Process invoice
   - Items are created automatically

3. **Create test items via Prisma Studio:**
   ```bash
   npx prisma studio
   ```
   - Navigate to "items" table
   - Click "Add Record"
   - Fill in required fields:
     - name
     - category
     - currentCostExGst
     - currentMarkup
     - currentSellExGst
     - currentSellIncGst

---

## 🎯 Success Indicators

After testing, you should see:

✅ **In Database (Prisma Studio):**
- Items have `display_order` values
- Items have `subcategory` values (for some items)
- Categories are assigned from Square CSV

✅ **In UI:**
- Items page has new buttons: Organize, Print Stock Check
- Organize page shows drag handles
- Print preview groups items by category
- Import section shows detailed results

✅ **In Print:**
- Stock check sheet matches `new-project/Stock Check.pdf` format
- Category headers are blue and prominent
- Items are organized logically

---

## 📞 Next Steps

Once Phase 1 is tested and working:

1. **Phase 2:** Implement 6-week sales analysis
2. **Phase 3:** Build vendor order calendar
3. **Phase 4:** Advanced features (automated orders, etc.)

See `new-project/instructions.prd` for full roadmap.

---

## 🔧 Development Commands

```bash
# Start dev server
npm run dev

# Check database
npx prisma studio

# View schema
cat prisma/schema.prisma

# Check types (will show errors, that's okay)
npm run type-check

# Generate Prisma client (if needed)
npx prisma generate
```

---

## 📝 Files to Check

### New Files Created:
- `src/app/api/items/bulk-update-positions/route.ts`
- `src/app/api/items/bulk-categorize/route.ts`
- `src/app/api/items/print-sheet/route.ts`
- `src/app/api/sales-reports/square-vendor/route.ts`
- `src/app/items/organize/page.tsx`
- `src/app/items/print-preview/page.tsx`
- `src/components/items/item-organizer.tsx`
- `src/components/items/square-csv-import.tsx`

### Modified Files:
- `prisma/schema.prisma` (added fields)
- `src/lib/validations.ts` (added schemas)
- `src/app/items/page.tsx` (added new buttons and import section)

---

**Ready to test! Free up disk space and run `npm run dev`** 🚀

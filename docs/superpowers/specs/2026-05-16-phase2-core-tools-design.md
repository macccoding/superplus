# Phase 2: Core Tools — Design Spec

**Date:** 2026-05-16
**Status:** Draft
**Scope:** Pricing Tool, Product Lookup, Closing Checklist + supporting data models (Category, Product, Checklist)

---

## 1. Context

Phase 1 delivered the hub (tasks, threads, logbook, announcements) and admin shell. Phase 2 adds the daily operational tools staff use on the floor: pricing calculations, product lookups, and end-of-day checklists.

### What's Being Built

Three tools under `/tools`:
1. **Pricing Tool** — unified calculator + margin rules management
2. **Product Lookup** — search/scan products, view full product cards
3. **Closing Checklist** — nightly sign-off with accountability trail

Plus supporting admin pages for product management, CSV import, category management, and checklist template configuration.

### Constraints

- 3,000–10,000 SKUs per store (CSV import from existing POS export)
- Staff see price/location/stock. Supervisors+ see cost/margin/supplier.
- Currency: JMD, no conversion needed, display as "$X,XXX.XX"
- Barcode scan is a bonus feature (search-first), using browser BarcodeDetector API
- Closing checklist requires mandatory reason for any skipped/N/A item
- One submission per checklist template per store per day (no double-submission)

---

## 2. Data Model

### Category

```prisma
model Category {
  id                  String   @id @default(cuid())
  storeId             String
  name                String
  defaultMarkupPercent Decimal  @default(30)
  sortOrder           Int      @default(0)
  isActive            Boolean  @default(true)
  createdAt           DateTime @default(now())

  store    Store     @relation(fields: [storeId], references: [id])
  products Product[]

  @@unique([storeId, name])
  @@index([storeId, sortOrder])
}
```

### Product

```prisma
model Product {
  id              String      @id @default(cuid())
  storeId         String
  categoryId      String?
  name            String
  barcode         String?
  sku             String?
  costPrice       Decimal
  retailPrice     Decimal
  markupPercent   Decimal
  useCustomMarkup Boolean     @default(false)
  location        String?
  supplier        String?
  stockStatus     StockStatus @default(IN_STOCK)
  isActive        Boolean     @default(true)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  store    Store     @relation(fields: [storeId], references: [id])
  category Category? @relation(fields: [categoryId], references: [id])

  @@unique([storeId, barcode])
  @@index([storeId, name])
  @@index([storeId, categoryId])
}

enum StockStatus {
  IN_STOCK
  LOW
  OUT_OF_STOCK
}
```

### ChecklistTemplate + Items

```prisma
model ChecklistTemplate {
  id        String   @id @default(cuid())
  storeId   String
  name      String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  store       Store                  @relation(fields: [storeId], references: [id])
  items       ChecklistTemplateItem[]
  submissions ChecklistSubmission[]

  @@index([storeId])
}

model ChecklistTemplateItem {
  id         String  @id @default(cuid())
  templateId String
  label      String
  sortOrder  Int     @default(0)
  isRequired Boolean @default(true)

  template        ChecklistTemplate       @relation(fields: [templateId], references: [id], onDelete: Cascade)
  submissionItems ChecklistSubmissionItem[]

  @@index([templateId, sortOrder])
}
```

### ChecklistSubmission + Items

```prisma
model ChecklistSubmission {
  id           String   @id @default(cuid())
  storeId      String
  templateId   String
  submittedById String
  date         DateTime @db.Date
  completedAt  DateTime @default(now())
  notes        String?

  store      Store              @relation(fields: [storeId], references: [id])
  template   ChecklistTemplate  @relation(fields: [templateId], references: [id])
  submittedBy User              @relation(fields: [submittedById], references: [id])
  items      ChecklistSubmissionItem[]

  @@unique([storeId, templateId, date])
  @@index([storeId, date])
}

model ChecklistSubmissionItem {
  id               String              @id @default(cuid())
  submissionId     String
  templateItemId   String
  status           ChecklistItemStatus
  reason           String?

  submission   ChecklistSubmission   @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  templateItem ChecklistTemplateItem @relation(fields: [templateItemId], references: [id])

  @@index([submissionId])
}

enum ChecklistItemStatus {
  DONE
  SKIPPED
  NOT_APPLICABLE
}
```

### Key Decisions

- `costPrice` and `retailPrice` are Decimal (not Float) for currency accuracy
- `markupPercent` on Product overrides category default when `useCustomMarkup` is true
- Products are store-scoped (same product, different stores = potentially different pricing)
- Barcode is unique per store (enforced by `@@unique([storeId, barcode])`)
- ChecklistSubmission enforces one-per-day with `@@unique([storeId, templateId, date])`
- Skipped/N/A items require `reason` — enforced at the tRPC mutation layer, not DB constraint

---

## 3. Tool 1: Pricing Tool

**Route:** `/tools/pricing`
**Access:** All staff can use calculator. Supervisor+ can edit margin rules.

### Quick Calculator (default view)

- Large number input area (big digits, like a phone calculator)
- Staff enters a cost price
- Instantly shows a grid of retail prices at multiple margins:
  - "At 25%: $X | At 30%: $X | At 35%: $X | At 40%: $X"
- Category dropdown at top: selecting a category highlights its default margin in the grid
- "Save to Product" button opens a form to persist the calculation as a new product record

### Margin Rules (supervisor+ tab)

- Segmented tab: "Calculator" | "Margin Rules" (rules tab hidden for staff)
- List of categories with their default markup percentages
- Inline editing: tap a category → edit its markup percentage
- Shows impact count: "42 products using this rate"
- Manager can add/remove categories from this view

### Edge Cases

- Cost = 0: show "N/A" for retail prices (avoid division by zero)
- Negative margins: allow (loss leaders) but show orange warning badge
- All math is client-side (works offline)
- Currency format: JMD, "$X,XXX.XX" pattern

---

## 4. Tool 2: Product Lookup

**Route:** `/tools/product-lookup`
**Access:** All staff can search. Supervisor+ sees cost/margin/supplier on detail view.

### Search Interface

- Large search bar at top (auto-focus on page load)
- Instant results as user types (debounced 300ms)
- Filter row below search: category dropdown + stock status chips (All | In Stock | Low | Out)
- Results: card list showing product name, retail price, location, stock dot indicator
- Empty search state: "Search by name or barcode" prompt

### Product Detail (`/tools/product-lookup/[id]`)

**Everyone sees:**
- Product name, barcode (if set), retail price (large), location, stock status, category

**Supervisor+ also sees:**
- Cost price, markup %, supplier, last updated date
- "Edit" button linking to admin edit page

### Barcode Scan

- Camera icon button next to search bar
- Opens device camera using browser `BarcodeDetector` API
- On successful scan: auto-populates search with barcode value
- Fallback: if BarcodeDetector not supported, show "Enter barcode manually" prompt
- No third-party scanning library needed

### Search Performance

- Prisma `contains` with `mode: insensitive` for name search
- Direct `equals` for barcode search (detected by pattern: all digits, 8-13 chars)
- Composite indexes on `(storeId, name)` and `(storeId, barcode)` ensure fast queries at 10K scale
- Paginated results (20 per page) with "Load more" button

---

## 5. Tool 3: Closing Checklist

**Route:** `/tools/closing-checklist`
**Access:** Supervisor+ can submit checklists. Manager+ configures templates.

### Staff/Supervisor View (Filling Out)

- On open: if only one active template for the store, go directly to it. If multiple, show selection.
- Checklist shows ordered list of items, each as a large card with three action buttons:
  - Done (green check) — default expected state
  - Skipped (orange skip icon) — triggers mandatory reason input
  - N/A (grey dash) — triggers mandatory reason input
- Reason input: bottom sheet with textarea, "Save" button
- Progress indicator at top: "8 of 12 items completed"
- "Submit & Sign Off" button appears when all items are addressed
- Confirmation modal: "Closing checklist completed by [name] at [time]. This cannot be edited."
- After submission: success state with summary

### Manager View (Admin)

**Template management (`/admin/checklists`):**
- List of templates for the store
- Create new template: name + add items
- Edit template: add/remove/reorder items (up/down arrow buttons — simpler than drag)
- Mark items as required vs optional
- Deactivate templates (soft delete)

**Submission history (`/admin/checklists/submissions`):**
- Date-filtered list of past submissions
- Each shows: date, who submitted, completion time, completion %
- Skipped/N/A items highlighted in orange/grey with their reasons
- Expandable detail view per submission

### Edge Cases

- Double submission: `@@unique([storeId, templateId, date])` prevents DB-level. UI checks before showing the form.
- Late submission: allowed, timestamp records actual time. Shows in history with actual time.
- Partial fill: cannot submit until every item has a status
- Template edited after submission: submissions reference `templateItemId` — the label at submission time is preserved because the item record still exists (items are soft-deleted or kept for history)
- Offline: template items can be cached, form filled offline, submission queued for sync on reconnect

---

## 6. Admin Product Management

**Route:** `/admin/products`

### Product List

- Searchable/filterable table: name, category, price, stock status, barcode
- Pagination (50 per page)
- Bulk actions: none for v1 (keep simple)
- "Add Product" button → create form
- Row click → edit form

### Product Create/Edit (`/admin/products/[id]`)

- Form fields: name, barcode, sku, category (dropdown), cost price, retail price, markup % (auto-calculated or manual override), location, supplier, stock status
- Auto-calculate: when cost changes and `useCustomMarkup` is false, retail = cost * (1 + category.defaultMarkupPercent/100)
- When `useCustomMarkup` toggled on: retail price becomes manually editable, markup % shows the effective margin

### CSV Import (`/admin/products/import`)

1. Upload step: drag-drop or file picker. Client parses with PapaParse (~7KB library).
2. Preview step: shows first 10 rows in a table.
3. Column mapping step: auto-detect common headers (name, barcode, cost, price, category). Manager can remap any column to any field.
4. Required fields: `name`, `costPrice`, `retailPrice`. Optional: `barcode`, `sku`, `category`, `location`, `supplier`.
5. If `category` value doesn't exist in DB → auto-create with 0% default markup.
6. Import step: sends rows in batches of 200 to tRPC mutation. Progress bar.
7. Summary: "Imported 4,218 products. 12 rows skipped." Downloadable error report (JSON or CSV of failed rows with reasons).
8. Errors (missing name, invalid price, duplicate barcode) skip the row — never fail the batch.

---

## 7. tRPC Routers

### `products` router

```
search(query, categoryId?, stockStatus?, cursor?) → paginated products
getById(id) → full product (role-filtered fields)
create(data) → product (supervisor+)
update(id, data) → product (supervisor+)
importBatch(products[]) → { imported: number, errors: { row, reason }[] } (manager+)
```

### `categories` router

```
list() → categories with product counts
create(name, defaultMarkupPercent) → category (manager+)
update(id, name?, defaultMarkupPercent?) → category (manager+)
delete(id) → void (manager+, fails if products exist)
```

### `checklists` router

```
listTemplates() → templates for current store
getTemplate(id) → template with items
createTemplate(name, items[]) → template (manager+)
updateTemplate(id, name?, items?) → template (manager+)
submit(templateId, items: { templateItemId, status, reason? }[]) → submission (supervisor+)
listSubmissions(dateFrom?, dateTo?) → submissions (manager+)
getSubmission(id) → full submission with items (manager+)
```

---

## 8. Route Structure

### Tools routes (staff-facing)

```
/tools/pricing              → calculator + margin rules tabs
/tools/product-lookup       → search + results
/tools/product-lookup/[id]  → product detail card
/tools/closing-checklist    → fill out checklist + submit
/tools/closing-checklist/history → past submissions (supervisor+)
```

### Admin routes (manager-facing)

```
/admin/products             → product table
/admin/products/new         → create product form
/admin/products/[id]        → edit product form
/admin/products/import      → CSV import wizard
/admin/categories           → category list + markup editing
/admin/checklists           → template management
/admin/checklists/[id]      → edit template items
/admin/checklists/submissions ��� submission history
```

### Admin sidebar additions

Add to existing sidebar nav:
- Products (icon: `inventory_2`)
- Categories (icon: `category`)
- Checklists (icon: `checklist`)

---

## 9. Dependencies

**New packages needed:**
- `papaparse` + `@types/papaparse` — CSV parsing (client-side, ~7KB)
- No barcode library needed (browser-native `BarcodeDetector` API)

**Prisma schema additions:**
- 6 new models: Category, Product, ChecklistTemplate, ChecklistTemplateItem, ChecklistSubmission, ChecklistSubmissionItem
- 2 new enums: StockStatus, ChecklistItemStatus
- New relation on User: `checklistSubmissions`
- New relations on Store: `categories`, `products`, `checklistTemplates`, `checklistSubmissions`

---

## 10. Offline Behavior

| Tool | Offline Support |
|------|----------------|
| Pricing calculator | Full — pure client-side math |
| Pricing margin rules | Read-only (cached list) |
| Product lookup | No — requires DB search |
| Product detail | Cached if recently viewed |
| Closing checklist (fill) | Yes — cache template, queue submission |
| Closing checklist (history) | No — requires DB query |

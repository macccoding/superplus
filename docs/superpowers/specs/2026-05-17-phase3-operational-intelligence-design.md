# Phase 3: Operational Intelligence — Design Spec

**Date:** 2026-05-17
**Status:** Approved
**Scope:** Expiry Tracker, Stock-Out Reporter, Incident Logger, Admin Reports

---

## 1. Context

Phase 2 delivered pricing tools, product lookup, and closing checklists. Phase 3 adds reactive operational tools — staff report issues as they encounter them, and managers get dashboards showing operational health across time.

---

## 2. Data Model

### ExpiryAlert

```prisma
model ExpiryAlert {
  id          String       @id @default(cuid())
  storeId     String
  productId   String?
  productName String
  expiryDate  DateTime     @db.Date
  quantity    Int          @default(1)
  location    String?
  reportedById String
  status      ExpiryStatus @default(ACTIVE)
  resolvedAt  DateTime?
  createdAt   DateTime     @default(now())

  store      Store    @relation(fields: [storeId], references: [id])
  product    Product? @relation(fields: [productId], references: [id])
  reportedBy User     @relation("ExpiryReporter", fields: [reportedById], references: [id])

  @@index([storeId, status, expiryDate])
}

enum ExpiryStatus {
  ACTIVE
  PULLED
  RESOLVED
}
```

### StockOutReport

```prisma
model StockOutReport {
  id          String         @id @default(cuid())
  storeId     String
  productId   String?
  productName String
  location    String?
  reportedById String
  status      StockOutStatus @default(REPORTED)
  resolvedAt  DateTime?
  resolvedById String?
  notes       String?
  createdAt   DateTime       @default(now())

  store      Store  @relation(fields: [storeId], references: [id])
  product    Product? @relation(fields: [productId], references: [id])
  reportedBy User   @relation("StockOutReporter", fields: [reportedById], references: [id])
  resolvedBy User?  @relation("StockOutResolver", fields: [resolvedById], references: [id])

  @@index([storeId, status])
  @@index([storeId, createdAt])
}

enum StockOutStatus {
  REPORTED
  ACKNOWLEDGED
  RESTOCKED
}
```

### Incident

```prisma
model Incident {
  id           String           @id @default(cuid())
  storeId      String
  reportedById String
  category     IncidentCategory
  title        String
  description  String
  severity     IncidentSeverity @default(MEDIUM)
  photoUrl     String?
  status       IncidentStatus   @default(OPEN)
  resolvedAt   DateTime?
  resolvedById String?
  resolution   String?
  createdAt    DateTime         @default(now())

  store      Store @relation(fields: [storeId], references: [id])
  reportedBy User  @relation("IncidentReporter", fields: [reportedById], references: [id])
  resolvedBy User? @relation("IncidentResolver", fields: [resolvedById], references: [id])

  @@index([storeId, status])
  @@index([storeId, createdAt])
}

enum IncidentCategory {
  EQUIPMENT
  SAFETY
  CUSTOMER
  THEFT
  MAINTENANCE
  OTHER
}

enum IncidentSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum IncidentStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}
```

### Key Design Decisions
- ExpiryAlert stores `productName` as text (works even without Product link — staff can type manually)
- StockOutReport is simple: reported → acknowledged → restocked lifecycle
- Incidents have severity + category for filtering and prioritization
- Photo support via URL (use Vercel Blob or external upload — just store URL for now)
- All models scoped by `storeId`

---

## 3. Tool 1: Expiry Tracker

**Route:** `/tools/expiry-tracker`
**Access:** All staff can report. Supervisor+ can mark as pulled/resolved.

### Staff View
- Quick-add form at top: product name (autocomplete from products), expiry date picker, quantity, location
- Below: list of active alerts sorted by urgency (expiring today → red, this week → orange, this month → grey)
- Each card shows: product name, expiry date, days until expiry, location, who reported
- Color-coded urgency: expired (dark red), today (red pulse), ≤3 days (orange), ≤7 days (yellow), >7 days (grey)

### Supervisor Actions
- Tap an alert → "Mark as Pulled" (removed from shelf) or "Resolve" (dealt with)
- Resolved items disappear from active list (viewable in admin reports)

---

## 4. Tool 2: Stock-Out Reporter

**Route:** `/tools/stock-out`
**Access:** All staff can report. Supervisor+ can acknowledge/restock.

### Staff View (one-tap report)
- Big search bar: find product by name or barcode
- Tap a product → confirm "Report stock-out?" → done (one tap after search)
- Or: "Report manually" button for products not in system (just type name + location)
- Shows "My recent reports" below (last 10)

### Supervisor View
- List of open reports sorted by newest
- Each card: product name, location, reported by, time ago
- Actions: "Acknowledge" (we know), "Restocked" (resolved)
- Counts badge on the hub icon grid showing open reports

---

## 5. Tool 3: Incident Logger

**Route:** `/tools/incidents`
**Access:** Supervisor+ can create. Manager+ can resolve/close.

### Create Incident
- Form: category (dropdown: Equipment, Safety, Customer, Theft, Maintenance, Other)
- Title (short), description (longer), severity (Low/Medium/High/Critical)
- Optional photo (device camera or gallery — upload to URL, store link)
- Submit creates the record

### Incident List
- Sorted by severity then date
- Cards with category icon, title, severity badge, status chip, reporter, time
- Tap → detail view with full description, photo, resolution history

### Resolution (Manager+)
- "Resolve" button on detail → add resolution notes → status changes to RESOLVED
- "Close" archives it

### Photo Upload
- For v1: use a simple base64 data URL stored in `photoUrl` (works for small images, <1MB)
- Future: upgrade to Vercel Blob for proper file storage

---

## 6. Admin Reports Dashboard

**Route:** `/admin/reports`
**Access:** Manager+

### Report Sections

**1. Task Performance**
- Tasks created vs completed (last 7/30 days)
- Average time to completion
- Completion rate % (pie chart or single metric)
- Most productive staff (top 5 by tasks completed)

**2. Checklist Compliance**
- % of days with checklist submitted (last 30 days)
- Most-skipped items (top 5)
- Average submission time

**3. Stock & Expiry**
- Active expiry alerts count
- Stock-out reports this week
- Most reported stock-out products (top 5)
- Average restock time

**4. Incidents**
- Open incidents by category (breakdown)
- Incidents this month vs last month
- Average resolution time

### Implementation Approach
- All server-side computed (Server Components or tRPC queries)
- Simple stat cards + lists — no chart library for v1 (just numbers and bars)
- Relative percentage bars using Tailwind width classes
- New `reports` tRPC router with aggregation queries

---

## 7. tRPC Routers

### `expiryAlerts` router
```
list(status?) → alerts sorted by urgency
create(productName, productId?, expiryDate, quantity?, location?) → alert
updateStatus(id, status) → alert (supervisor+)
```

### `stockOuts` router
```
list(status?) → reports sorted by date
create(productName, productId?, location?) → report
myRecent() → last 10 reports by current user
updateStatus(id, status, notes?) → report (supervisor+)
count() → open report count (for badge)
```

### `incidents` router
```
list(status?, category?) → incidents sorted by severity+date
create(category, title, description, severity, photoUrl?) → incident (supervisor+)
getById(id) → full incident
resolve(id, resolution) → incident (manager+)
close(id) → incident (manager+)
```

### `reports` router
```
taskPerformance(days: 7|30) → { created, completed, rate, avgTime, topStaff[] }
checklistCompliance(days: 30) → { submissionRate, avgTime, mostSkipped[] }
stockAndExpiry() → { activeAlerts, stockOutsThisWeek, topStockOuts[], avgRestockTime }
incidents(days: 30) → { openByCategory, thisMonth, lastMonth, avgResolutionTime }
```

---

## 8. Routes

### Tools (staff-facing)
```
/tools/expiry-tracker         → report + view expiry alerts
/tools/stock-out              → report stock-outs
/tools/incidents              → log + view incidents (supervisor+)
```

### Admin
```
/admin/reports                → reports dashboard with all 4 sections
```

### Admin sidebar addition
- Reports (icon: `analytics`)

### Tools home page additions
- Expiry (icon: `event_busy`, color: tertiary)
- Stock-Out (icon: `remove_shopping_cart`, color: error)
- Incidents (icon: `report_problem`, color: secondary) — supervisor+ only

---

## 9. Hub Integration

### Badge Counts on Hub Home
- The hub home icon grid should show badge counts for:
  - Tasks: count of tasks assigned to me that aren't done
  - Stock-Out: count of open reports (supervisor+ sees this)

### Activity Feed
- Stock-out reports and critical incidents appear in the admin activity feed
- Update the `activity` router to include these

---

## 10. Relations on Existing Models

Add to `Store`:
```prisma
expiryAlerts     ExpiryAlert[]
stockOutReports  StockOutReport[]
incidents        Incident[]
```

Add to `User`:
```prisma
expiryAlerts         ExpiryAlert[]   @relation("ExpiryReporter")
stockOutsReported    StockOutReport[] @relation("StockOutReporter")
stockOutsResolved    StockOutReport[] @relation("StockOutResolver")
incidentsReported    Incident[]       @relation("IncidentReporter")
incidentsResolved    Incident[]       @relation("IncidentResolver")
```

Add to `Product`:
```prisma
expiryAlerts    ExpiryAlert[]
stockOutReports StockOutReport[]
```

# Phase 5: Supply Chain & Growth — Design Spec

**Date:** 2026-05-17
**Status:** Approved
**Scope:** Supplier Orders, Promotions Board, Training/SOPs, Suggestion Box, Push Notifications

---

## 1. Context

Phases 1-4 delivered the hub, operational tools, and AI scheduling. Phase 5 completes the platform with supply chain management, staff training, feedback, and real-time notifications. After this phase, the platform covers the full operational lifecycle of a SuperPlus store.

---

## 2. Data Model

### Supplier

```prisma
model Supplier {
  id        String   @id @default(cuid())
  storeId   String
  name      String
  contact   String?
  phone     String?
  email     String?
  notes     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  store  Store           @relation(fields: [storeId], references: [id])
  orders PurchaseOrder[]

  @@unique([storeId, name])
  @@index([storeId])
}

model PurchaseOrder {
  id           String      @id @default(cuid())
  storeId      String
  supplierId   String
  orderNumber  String
  status       POStatus    @default(DRAFT)
  totalAmount  Decimal?
  notes        String?
  orderedAt    DateTime?
  expectedAt   DateTime?
  receivedAt   DateTime?
  createdById  String
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  store     Store             @relation(fields: [storeId], references: [id])
  supplier  Supplier          @relation(fields: [supplierId], references: [id])
  createdBy User              @relation("POCreator", fields: [createdById], references: [id])
  items     PurchaseOrderItem[]

  @@index([storeId, status])
  @@index([storeId, createdAt])
}

model PurchaseOrderItem {
  id              String  @id @default(cuid())
  orderId         String
  productName     String
  quantity        Int
  unitCost        Decimal
  receivedQty     Int?
  notes           String?

  order PurchaseOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId])
}

enum POStatus {
  DRAFT
  ORDERED
  PARTIALLY_RECEIVED
  RECEIVED
  CANCELLED
}
```

### Promotion

```prisma
model Promotion {
  id          String          @id @default(cuid())
  storeId     String
  title       String
  description String?
  type        PromotionType
  startDate   DateTime        @db.Date
  endDate     DateTime        @db.Date
  isActive    Boolean         @default(true)
  createdById String
  createdAt   DateTime        @default(now())

  store     Store @relation(fields: [storeId], references: [id])
  createdBy User  @relation("PromotionCreator", fields: [createdById], references: [id])
  items     PromotionItem[]

  @@index([storeId, isActive])
  @@index([storeId, startDate])
}

model PromotionItem {
  id            String  @id @default(cuid())
  promotionId   String
  productName   String
  originalPrice Decimal
  promoPrice    Decimal
  notes         String?

  promotion Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)

  @@index([promotionId])
}

enum PromotionType {
  WEEKLY_SPECIAL
  CLEARANCE
  SEASONAL
  BUNDLE
  OTHER
}
```

### Training/SOP

```prisma
model SOPGuide {
  id          String   @id @default(cuid())
  storeId     String?
  title       String
  description String?
  category    String
  steps       SOPStep[]
  isPublished Boolean  @default(false)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  store     Store? @relation(fields: [storeId], references: [id])
  createdBy User   @relation("SOPCreator", fields: [createdById], references: [id])

  @@index([storeId, category])
}

model SOPStep {
  id        String @id @default(cuid())
  guideId   String
  stepNumber Int
  title     String
  content   String
  imageUrl  String?

  guide SOPGuide @relation(fields: [guideId], references: [id], onDelete: Cascade)

  @@index([guideId, stepNumber])
}
```

### Suggestion Box

```prisma
model Suggestion {
  id          String           @id @default(cuid())
  storeId     String
  body        String
  category    SuggestionCategory @default(GENERAL)
  isAnonymous Boolean          @default(true)
  authorId    String?
  status      SuggestionStatus @default(NEW)
  response    String?
  respondedById String?
  respondedAt DateTime?
  createdAt   DateTime         @default(now())

  store       Store  @relation(fields: [storeId], references: [id])
  author      User?  @relation("SuggestionAuthor", fields: [authorId], references: [id])
  respondedBy User?  @relation("SuggestionResponder", fields: [respondedById], references: [id])

  @@index([storeId, status])
}

enum SuggestionCategory {
  GENERAL
  SAFETY
  SCHEDULE
  EQUIPMENT
  PROCESS
  OTHER
}

enum SuggestionStatus {
  NEW
  REVIEWED
  IMPLEMENTED
  DISMISSED
}
```

### Notification

```prisma
model Notification {
  id        String           @id @default(cuid())
  userId    String
  type      NotificationType
  title     String
  body      String?
  link      String?
  isRead    Boolean          @default(false)
  createdAt DateTime         @default(now())

  user User @relation(fields: [userId], references: [id])

  @@index([userId, isRead, createdAt])
}

enum NotificationType {
  TASK_ASSIGNED
  TASK_UPDATED
  ANNOUNCEMENT
  SCHEDULE_PUBLISHED
  STOCK_OUT
  INCIDENT
  SUGGESTION_RESPONSE
  GENERAL
}
```

---

## 3. Feature 1: Supplier Orders

### Manager UI (`/admin/suppliers`, `/admin/orders`)

**Supplier Management:**
- List of suppliers with contact info
- Add/edit suppliers (name, contact, phone, email, notes)

**Purchase Orders:**
- Create PO: select supplier → add line items (product name, qty, unit cost) → save as draft
- PO lifecycle: DRAFT → ORDERED (sent to supplier) → PARTIALLY_RECEIVED / RECEIVED
- Receive goods: check off items, enter received quantities, note discrepancies
- Auto-generate order number: `PO-{YYYYMMDD}-{sequence}`
- View PO history filtered by status, supplier, date range

### Key Interactions
- Create PO from product that's out of stock (link from stock-out report)
- Total amount auto-calculated from line items
- Mark as ORDERED sets `orderedAt` timestamp
- Receiving partial quantities changes status to PARTIALLY_RECEIVED
- All items received → RECEIVED

---

## 4. Feature 2: Promotions Board

### Manager UI (`/admin/promotions`)

**Create Promotion:**
- Title, description, type (Weekly Special, Clearance, Seasonal, Bundle, Other)
- Date range (start — end)
- Line items: product name, original price, promo price
- Activate/deactivate toggle

**Promotion List:**
- Active promotions at top, upcoming next, expired greyed out
- Filter by type, date range

### Staff View (`/hub/promotions`)

- Hub icon grid gets "Deals" tile
- Shows currently active promotions as cards
- Each card: title, dates, list of items with original → promo price (crossed out original)
- Staff use this to answer customer questions about deals

---

## 5. Feature 3: Training / SOPs

### Manager UI (`/admin/training`)

**Create Guide:**
- Title, description, category (e.g., "Opening Procedures", "Food Safety", "Customer Service")
- Add steps: numbered, each with title + content (text) + optional image URL
- Reorder steps with up/down arrows
- Publish/unpublish toggle
- Guides with `storeId: null` are global (visible to all stores)

### Staff View (`/hub/training`)

- Hub icon grid replaces "Tools" with "Learn" or adds a 7th tile
- List of published guides grouped by category
- Tap guide → step-by-step viewer
- One step at a time, swipe or Next/Back buttons
- Each step: numbered title, content text, optional image
- Progress indicator (Step 3 of 8)
- Big text, simple layout — designed for staff who may not read well

---

## 6. Feature 4: Suggestion Box

### Staff View (`/hub/suggestions`)

- Hub gets "Suggest" icon tile
- Simple form: textarea + category dropdown + anonymous toggle (default: on)
- If anonymous: `authorId` is null
- If named: `authorId` stored, name shown to managers
- After submit: "Thank you" confirmation
- Can view own past suggestions (if named) and see responses

### Manager View (`/admin/suggestions`)

- List of suggestions sorted by newest
- Each card shows: body text, category, anonymous/named, timestamp, status
- Manager can: mark as Reviewed, Implemented, or Dismissed + add response text
- Response visible to the original author (if named) in their suggestions list

---

## 7. Feature 5: Push Notifications (In-App)

### Architecture

For v1: **in-app notifications only** (not browser push). A notification bell icon in the header that shows unread count. Clicking opens a notification panel.

Future: upgrade to Web Push API with service worker.

### Notification Triggers

Notifications are created server-side when these events happen (via tRPC mutation hooks or explicit creation):

| Event | Recipient | Type |
|-------|-----------|------|
| Task assigned to user | Assignee | TASK_ASSIGNED |
| Task status changed | Creator + Assignee | TASK_UPDATED |
| New announcement (CRITICAL/IMPORTANT) | All store staff | ANNOUNCEMENT |
| Schedule published | All store staff | SCHEDULE_PUBLISHED |
| Stock-out reported | All supervisors | STOCK_OUT |
| Critical incident logged | All managers | INCIDENT |
| Suggestion gets a response | Author (if named) | SUGGESTION_RESPONSE |

### UI

**Header bell icon** (in AppShell):
- Bell icon with red badge showing unread count
- Tap → slide-out panel or dropdown showing recent notifications
- Each notification: icon by type, title, body preview, time ago, read/unread indicator
- Tap notification → navigate to `link` URL
- "Mark all as read" button

**Notification creation:**
- New `notifications` tRPC router with: `list`, `markRead`, `markAllRead`, `unreadCount`
- Notification creation happens inside existing mutations (e.g., when `tasks.create` assigns someone, also create a notification)
- Helper function `createNotification(userId, type, title, body?, link?)` used in routers

---

## 8. tRPC Routers

### `suppliers` router
```
list() → suppliers with order counts
create(name, contact?, phone?, email?, notes?) → supplier (manager+)
update(id, ...) → supplier (manager+)
```

### `orders` router
```
list(status?, supplierId?, dateFrom?, dateTo?) → orders with supplier + items
getById(id) → full order with items
create(supplierId, items[], notes?) → order (manager+)
update(id, status, notes?) → order (manager+)
receiveItems(orderId, items: {itemId, receivedQty}[]) → order (manager+)
```

### `promotions` router
```
list(activeOnly?) → promotions with items
active() → currently active promotions (for staff view)
create(title, type, startDate, endDate, items[], description?) → promotion (manager+)
update(id, ...) → promotion (manager+)
toggleActive(id) → promotion (manager+)
```

### `training` router
```
listGuides(category?) → published guides grouped by category
getGuide(id) → guide with steps
createGuide(title, category, description?, steps[]) → guide (manager+)
updateGuide(id, ...) → guide (manager+)
togglePublish(id) → guide (manager+)
```

### `suggestions` router
```
submit(body, category, isAnonymous) → suggestion (all staff)
myList() → my suggestions with responses
listAll(status?) → all suggestions (manager+)
respond(id, response, status) → suggestion (manager+)
```

### `notifications` router
```
list(limit?) → recent notifications for current user
unreadCount() → number
markRead(id) → notification
markAllRead() → void
```

---

## 9. Routes

### Hub (staff)
```
/hub/promotions      → active deals view
/hub/training        → guide list
/hub/training/[id]   → step-by-step viewer
/hub/suggestions     → submit + view my suggestions
```

### Admin (manager+)
```
/admin/suppliers     → supplier management
/admin/orders        → purchase orders
/admin/orders/new    → create PO
/admin/orders/[id]   → PO detail + receiving
/admin/promotions    → promotion management
/admin/promotions/new → create promotion
/admin/training      → guide management
/admin/training/new  → create guide
/admin/training/[id] → edit guide
/admin/suggestions   → review suggestions
```

### Navigation Updates
- Hub icon grid: add "Deals" (icon: `sell`), replace or supplement with "Learn" (icon: `school`), add "Suggest" (icon: `lightbulb`)
- Admin sidebar: add Suppliers, Orders, Promotions, Training, Suggestions
- AppShell header: add notification bell icon

---

## 10. Relations on Existing Models

Add to `Store`:
```prisma
  suppliers    Supplier[]
  orders       PurchaseOrder[]
  promotions   Promotion[]
  sopGuides    SOPGuide[]
  suggestions  Suggestion[]
```

Add to `User`:
```prisma
  createdOrders      PurchaseOrder[] @relation("POCreator")
  createdPromotions  Promotion[]     @relation("PromotionCreator")
  createdSOPGuides   SOPGuide[]      @relation("SOPCreator")
  suggestions        Suggestion[]    @relation("SuggestionAuthor")
  suggestionResponses Suggestion[]   @relation("SuggestionResponder")
  notifications      Notification[]
```

---

## 11. Implementation Order

Given dependencies:
1. **Notifications** first (header bell + router) — everything else creates notifications
2. **Suggestion Box** (simplest feature, gives staff immediate value)
3. **Training/SOPs** (important for staff onboarding)
4. **Promotions Board** (staff need this for customer interactions)
5. **Supplier Orders** (most complex, manager-only, least urgent for staff rollout)

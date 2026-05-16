# SuperPlus Platform — Design Spec

**Date:** 2026-05-16
**Status:** Draft
**Scope:** Full platform architecture + Phase 1 (Hub) detailed spec

---

## 1. Context

### What is SuperPlus?

SuperPlus Food Stores is a family-owned Jamaican supermarket chain, founded in 1964 by Vincent and Gloria Chen in Port Antonio. Once Jamaica's largest retailer (24 stores, 1500 employees), now operating ~8 stores concentrated in rural mid-Jamaica — Manchester, Clarendon, St Elizabeth, Westmoreland, and St Ann.

### The Problem

Store operations currently run on WhatsApp groups and paper:
- WhatsApp: chaotic, things get lost, no accountability, no way to assign or track tasks
- Paper: checklists, notice boards, verbal instructions — no visibility for anyone not physically present
- No continuity between days — incoming managers don't know what happened yesterday
- No cross-store visibility for owners

### The Solution

A unified internal platform that replaces WhatsApp chaos and paper with structured communication, task management, and operational tools — deployed as a PWA that staff access on personal phones and back-office tablets.

### Design Constraints

- **Staff literacy:** Many employees have limited formal education. The UI must be icon-driven, bold, forgiving, and non-intimidating.
- **Devices:** Personal Android phones (floor staff) + shared tablets/desktops (back office). Mobile-first, responsive up.
- **Connectivity:** Rural Jamaica, spotty mobile data. Must handle intermittent connection gracefully.
- **Single builder:** One developer (owner) building and maintaining. Architecture must minimize operational overhead.

---

## 2. Architecture

### Approach: Single App, Subdomain Routing

One Next.js 16 app deployed on Vercel. Subdomains are cosmetic — middleware rewrites them to internal route groups. This gives clean URL separation without the infrastructure cost of multiple deployments.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Components) |
| Database | Neon PostgreSQL via Prisma 7 (`@prisma/adapter-neon`) |
| Auth | NextAuth 5 (beta.30+) — phone+PIN credentials |
| Styling | Tailwind v4 |
| Hosting | Vercel |
| Offline | Workbox service worker |
| AI | Claude API via Vercel AI SDK (shift scheduler, future) |
| Monorepo | Turborepo + pnpm |

### Monorepo Structure

```
apps/
  web/                    # the single Next.js app
packages/
  db/                     # Prisma schema, client, queries
  ui/                     # shared components (icon grid, cards, shells)
  config/                 # brand tokens, roles, constants
  ai/                     # Claude API wrappers (future: shift scheduler)
```

### Subdomain Routing

```
hub.<domain>       → middleware rewrites to /(hub)/*
admin.<domain>     → middleware rewrites to /(admin)/*
tools.<domain>     → middleware rewrites to /(tools)/*
```

Domain TBD (likely a Vercel subdomain initially, custom domain later). Local development uses path-based routing (`localhost:3000/hub`, `/admin`, `/tools`). Subdomain routing activates on deployed environments only.

### Middleware Flow

1. Extract subdomain from Host header
2. No subdomain or "www" → redirect to hub (hub is the default experience)
3. Map subdomain to route prefix
4. Auth check:
   - No session → redirect to `/login`
   - `admin.*` requires `owner` or `manager` role
   - `hub.*` and `tools.*` accessible to all authenticated users
5. Rewrite URL internally

### Route Groups

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── layout.tsx              # minimal, no nav
├── (hub)/
│   ├── layout.tsx              # mobile shell, bottom nav
│   ├── page.tsx                # home screen (icon grid)
│   ├── tasks/
│   ├── threads/
│   ├── logbook/
│   └── announcements/
├── (admin)/
│   ├── layout.tsx              # sidebar nav, desktop-first
│   ├── page.tsx                # cross-store dashboard
│   ├── stores/
│   ├── people/
│   ├── activity/
│   └── settings/
├── (tools)/
│   ├── layout.tsx              # minimal shell, back-to-hub
│   ├── calculator/
│   ├── product-lookup/
│   ├── markup/
│   └── closing-checklist/
└── api/
    ├── auth/[...nextauth]/
    └── trpc/
```

### API Layer

- tRPC for internal data fetching (type-safe, pairs with Prisma)
- All mutations scoped by `store_id` from session
- Server Components fetch directly via Prisma where no round-trip is needed

---

## 3. Data Model

### Multi-Tenancy

Every record has a `store_id` foreign key. Middleware resolves the user's store from their session. All queries are scoped by store unless the user has `owner` or `manager` role viewing cross-store data.

### Core Entities

```prisma
model Store {
  id        String   @id @default(cuid())
  name      String
  parish    String
  address   String
  phone     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  users         User[]
  threads       Thread[]
  tasks         Task[]
  logEntries    LogEntry[]
  announcements Announcement[]
}

model User {
  id        String   @id @default(cuid())
  storeId   String
  fullName  String
  phone     String   @unique
  pinHash   String
  role      Role     @default(STAFF)
  email     String?
  avatarUrl String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  store             Store           @relation(fields: [storeId], references: [id])
  createdThreads    Thread[]        @relation("ThreadAuthor")
  threadMessages    ThreadMessage[]
  createdTasks      Task[]          @relation("TaskCreator")
  assignedTasks     Task[]          @relation("TaskAssignee")
  logEntries        LogEntry[]
  announcements     Announcement[]
}

enum Role {
  OWNER
  MANAGER
  SUPERVISOR
  STAFF
}
```

### Hub Entities

```prisma
model Thread {
  id         String         @id @default(cuid())
  storeId    String
  authorId   String
  title      String
  category   ThreadCategory @default(GENERAL)
  isPinned   Boolean        @default(false)
  isResolved Boolean        @default(false)
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt

  store    Store           @relation(fields: [storeId], references: [id])
  author   User            @relation("ThreadAuthor", fields: [authorId], references: [id])
  messages ThreadMessage[]
}

enum ThreadCategory {
  GENERAL
  URGENT
  MAINTENANCE
  INVENTORY
  OTHER
}

model ThreadMessage {
  id        String   @id @default(cuid())
  threadId  String
  authorId  String
  body      String
  createdAt DateTime @default(now())

  thread Thread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  author User   @relation(fields: [authorId], references: [id])
}

model Task {
  id           String     @id @default(cuid())
  storeId      String
  title        String
  description  String?
  category     String?
  createdById  String
  assignedToId String?
  priority     Priority   @default(NORMAL)
  status       TaskStatus @default(OPEN)
  dueDate      DateTime?
  completedAt  DateTime?
  createdAt    DateTime   @default(now())

  store      Store @relation(fields: [storeId], references: [id])
  createdBy  User  @relation("TaskCreator", fields: [createdById], references: [id])
  assignedTo User? @relation("TaskAssignee", fields: [assignedToId], references: [id])
}

enum Priority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum TaskStatus {
  OPEN
  IN_PROGRESS
  DONE
  CANCELLED
}

model LogEntry {
  id        String       @id @default(cuid())
  storeId   String
  authorId  String
  date      DateTime     @db.Date
  body      String
  category  LogCategory  @default(GENERAL)
  isFlagged Boolean      @default(false)
  createdAt DateTime     @default(now())

  store  Store @relation(fields: [storeId], references: [id])
  author User  @relation(fields: [authorId], references: [id])
}

enum LogCategory {
  GENERAL
  INCIDENT
  HANDOVER
  INVENTORY
}

model Announcement {
  id        String           @id @default(cuid())
  storeId   String?
  authorId  String
  title     String
  body      String
  priority  AnnouncePriority @default(NORMAL)
  expiresAt DateTime?
  createdAt DateTime         @default(now())

  store  Store? @relation(fields: [storeId], references: [id])
  author User   @relation(fields: [authorId], references: [id])
}

enum AnnouncePriority {
  NORMAL
  IMPORTANT
  CRITICAL
}
```

### Future Entities (Planned, Not Built)

- `Product`, `Category`, `Supplier` — product lookup, markup tool
- `Checklist`, `ChecklistItem` — closing checklist with supervisor sign-off
- `ShiftSchedule`, `ShiftSlot` — AI scheduler
- `StockEvent` — stock-out reporter
- `ExpiryAlert` — expiry tracker
- `Incident` — incident logger with photo support

---

## 4. Auth

### Login Flow

Staff log in with **phone number + 4-digit PIN**. No emails for floor staff — minimal friction, familiar interaction.

1. Staff opens app → sees phone number input (large, numeric keypad auto-opens)
2. Enters phone → sees PIN input (4 large boxes, like a phone unlock)
3. PIN matches → session created, redirected to hub home
4. PIN fails → "Wrong PIN. Try again." (3 attempts, then 30-second cooldown)

### Session Management

- Long-lived sessions (30 days) — staff shouldn't re-auth daily
- Session stores: `userId`, `storeId`, `role`, `fullName`
- NextAuth JWT strategy (stateless, no session table needed)

### Role Hierarchy

```
OWNER    (4) — sees all stores, full admin access
MANAGER  (3) — sees own store + admin dashboard
SUPERVISOR (2) — can create tasks, manage checklists, view logbook
STAFF    (1) — can view/complete tasks, post in threads, write log entries
```

### PIN Management

- Initial PIN set by manager when adding staff
- Staff can change their own PIN from profile
- Manager can reset a forgotten PIN in-person via admin panel
- PINs are hashed (bcrypt) — never stored in plaintext

---

## 5. UI/UX Design

### Design Principles

1. **Big, bold, forgiving** — min 48px tap targets, high contrast, generous spacing. A tired cashier at 6pm shouldn't have to squint.
2. **Icon-first navigation** — home screen is a grid of colored icons with 1-2 word labels. Staff learn by color and position, not reading.
3. **Progressive disclosure** — simple action first, details behind a tap. Create task = tap "+" → type title → done. Priority and assignment are optional.
4. **Familiar patterns** — threads look like WhatsApp conversations. Lists look like phone contacts.
5. **Status over decoration** — color means something. Red = urgent/overdue. Green = done. Orange = needs attention. No decorative color.
6. **One hand, one thumb** — primary actions in the bottom half of the screen on mobile.

### Navigation Structure

**Hub (mobile-first):**

```
HOME SCREEN — 2x3 icon grid (phone), 3x2 (tablet)
├── Tasks          → my tasks, pickup board, create
├── Threads        → store conversations, pinned
├── Logbook        → today's notes, past days, add entry
├── Announcements  → current, broadcast (managers)
├── My Profile     → name, PIN change, schedule
└── More           → links to tools apps
```

**Admin (desktop-first):**

```
SIDEBAR NAV
├── Stores         → overview, switch between stores
├── People         → staff list, roles, activate/deactivate
├── Activity       → cross-store feed of tasks, threads
├── Reports        → completion rates, logbook summaries
└── Settings       → store config, categories
```

### Key Interactions

**Task pickup:**
Staff → Tasks → "Available" tab → tap a task → "Take this task" → it's theirs

**Quick log:**
Floating "+" on logbook → type what happened → submit. Optional: flag for manager attention.

**Thread reply:**
Tap thread → type at bottom (WhatsApp-style) → send. @mentions notify specific people.

**Critical announcement:**
Red banner at top of home screen. Cannot be dismissed without tapping to read.

### Responsive Breakpoints

| Breakpoint | Target | Layout |
|-----------|--------|--------|
| < 640px | Phone | Single column, bottom nav, 2x3 icon grid |
| 640-1024px | Tablet | 3x2 icon grid, list+detail side by side |
| > 1024px | Desktop/Admin | Sidebar nav, data tables, multi-panel |

### Brand Tokens

```
Colors:
  primary:       #E31837  (SuperPlus red)
  secondary:     #1B3A5C  (navy — headers, admin)
  accent:        #F5A623  (orange — warnings, attention)
  success:       #2ECC71  (green — done, active)
  danger:        #E74C3C  (red — urgent, overdue)
  background:    #F8F9FA  (light grey)
  surface:       #FFFFFF  (cards, inputs)
  textPrimary:   #1A1A2E  (near-black)
  textSecondary: #6B7280  (grey)

Typography:
  heading: Inter, system-ui, sans-serif
  body:    system-ui, -apple-system, sans-serif

Radius:
  card:   12px
  button: 8px
  input:  6px

Spacing:
  touch-target minimum: 48px
  card padding: 16px
  grid gap: 12px
```

---

## 6. Offline / PWA

### Scope

App shell caching + read-only data cache. Not a full offline-first app.

### What Works Offline

- App shell (nav, layouts, icons) — always cached
- Last-viewed tasks, threads, logbook entries — cached for reading
- Announcements — cached and shown
- Queued actions — log entry or task update submitted offline queues and syncs on reconnect

### What Requires Connection

- Creating/replying to threads (server notifies others)
- Cross-store data (admin views)
- AI features (shift scheduler)
- Login

### Implementation

- Workbox for service worker management
- NetworkFirst for API data, CacheFirst for static assets
- IndexedDB for queued offline mutations (simple pending-action array)
- On reconnect: flush queue, last-write-wins for simple fields
- Visual: subtle bar at top when offline — "You're offline. Changes will sync when connected."

### PWA Manifest

- `display: standalone`
- Theme color: `#E31837`
- Icons: SuperPlus logo at required sizes
- Start URL: `/hub`

---

## 7. AI Shift Scheduler (Phase 4 Design)

### Inputs

Manager provides once, system remembers:
- Store hours per day
- Staff list with availability constraints ("Keisha can't do Sundays")
- Role requirements per shift ("always 1 supervisor on floor")
- Budget constraint (max hours/week per person)
- Historical patterns (system learns over time)

### Output

- Weekly schedule draft as structured JSON
- Flagged conflicts or gaps
- Manager reviews → approves / edits → publishes

### Integration

- Claude API via Vercel AI SDK
- Prompt includes: store config, staff, constraints, previous schedule, special notes
- Returns structured JSON — array of shift slots with assigned staff
- Manager sees visual calendar grid, can drag/drop to adjust
- "Regenerate" button for wholesale changes
- Natural language adjustments: "Give Keisha more morning shifts this month"
- Can explain reasoning: "Marcus got Saturday because he hasn't had a weekend in 3 weeks"

### Why Claude Over a Rules Engine

Scheduling with soft constraints (fairness, preferences, history) is where LLMs excel over rigid algorithms. Natural language input lowers the bar for managers.

---

## 8. Build Phases

### Phase 1 — Foundation + Hub (BUILD NOW)

- Project scaffold (Next.js 16, Prisma 7, Neon, Tailwind v4, NextAuth 5, tRPC)
- Subdomain middleware + route groups
- Auth (phone + PIN, role-based access)
- Multi-tenant store scoping
- Hub: home screen, tasks, threads, logbook, announcements
- Admin shell: store switcher, people management, activity feed
- PWA manifest + service worker (app shell caching)

### Phase 2 — Core Tools

- Calculator (margin/pricing)
- Product Lookup (search + barcode scan)
- Markup/Margin Tool (cost → retail with configurable rules)
- Closing Checklist (per-store config, supervisor sign-off)

### Phase 3 — Operational Intelligence

- Expiry Tracker (log dates, urgency alerts)
- Stock-Out Reporter (one-tap from floor, notifies supervisor)
- Incident Logger (categorized, optional photo, paper trail)
- Admin reports (completion rates, logbook summaries, response times)

### Phase 4 — AI & Scheduling

- AI Shift Scheduler (generate, review, publish)
- Staff availability self-service
- Schedule history + fairness tracking
- Natural language adjustments

### Phase 5 — Supply Chain & Growth

- Supplier Orders (PO creation, delivery tracking)
- Promotions/Specials Board (manage deals, generate signage)
- Training/SOPs (visual step-by-step procedures)
- Suggestion Box (anonymous staff feedback)
- Push notifications (critical announcements, task assignments)

---

## 9. Full App Suite Reference

| App | Subdomain | Phase | Access |
|-----|-----------|-------|--------|
| Hub (tasks, threads, logbook, announcements) | hub.* | 1 | All staff |
| Admin Dashboard | admin.* | 1 | Owner, Manager |
| Calculator | tools.* | 2 | All staff |
| Product Lookup | tools.* | 2 | All staff |
| Markup/Margin Tool | tools.* | 2 | Supervisor+ |
| Closing Checklist | tools.* | 2 | Supervisor+ |
| Expiry Tracker | tools.* | 3 | All staff |
| Stock-Out Reporter | tools.* | 3 | All staff |
| Incident Logger | tools.* | 3 | Supervisor+ |
| AI Shift Scheduler | admin.* | 4 | Manager+ |
| Supplier Orders | admin.* | 5 | Manager+ |
| Promotions Board | tools.* | 5 | Supervisor+ |
| Training/SOPs | hub.* | 5 | All staff |
| Suggestion Box | hub.* | 5 | All staff |

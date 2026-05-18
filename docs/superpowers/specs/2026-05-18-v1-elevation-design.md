# SuperPlus v1.0 Elevation — Design Spec

**Date:** 2026-05-18
**Status:** Approved
**Scope:** Visual identity overhaul + 5 missing features = production-ready v1.0

---

## 1. Aesthetic Direction: "Vibrant Industrial"

Bold, saturated, unapologetic. The UI has the confidence of a sports brand and the clarity of a well-designed power tool. Red is THE identity — not an accent.

**DFII Score: 15/15** (Excellent — execute fully)

**Differentiation Anchor:**
> "If screenshotted with the logo removed, the red header + warm background + Sora font + vibrant icon circles make it instantly recognizable as SuperPlus."

---

## 2. Brand Foundation

### Logo
- Real S+ swoosh logo from `/public/logo.png` (red on transparent)
- Login: large centered logo image (96px)
- Header: small logo mark (~28-32px) on red background
- PWA icons: logo on red background at 192/512px
- Favicon: S+ mark

### Colors
```
--brand-red: #E31837          (THE color — headers, buttons, active, hero)
--brand-red-dark: #B81430     (hover/pressed)
--brand-red-light: #FF4D6A    (highlights, badges, gradients)
--brand-black: #1A1A2E        (text, dark elements)
--brand-navy: #1B2A4A         (admin sidebar, depth)
--surface-white: #FFFFFF      (cards)
--surface-warm: #FFF8F6       (page backgrounds — warm, not cold grey)
--surface-cream: #FFF0EC      (subtle red-tinted sections)
--success: #22C55E            (vivid green)
--warning: #F59E0B            (amber)
--error: #EF4444              (red — distinct from brand-red)
--text-primary: #1A1A2E
--text-secondary: #6B7280
--text-on-red: #FFFFFF
```

### Typography
- **Font:** Sora (Google Fonts) — all weights from 400-800
- Page titles: 24-32px, bold (700)
- Body: 14-16px, regular (400)
- Labels: 12px, medium (500), uppercase for badges
- Button text: 16px, bold (700)

### Key Visual Changes
- Background: cold grey `#F8F9FA` → warm `#FFF8F6`
- Header: white → **red #E31837** with white logo + text
- Cards: subtle shadow → prominent shadow with 16px radius
- Info cards: muted → red gradient (#E31837 → #FF4D6A) with white text
- Icons: outlined → filled, on vibrant colored circles
- Buttons: muted → vivid red with shadow-md
- Active/tap: scale-95 + shadow change (physical press)

---

## 3. Component Changes

### AppShell Header
- **Red background** (#E31837), full width, 64px height
- White S+ logo image (28px height) + "SuperPlus" in white Sora bold
- Right: notification bell (white) with red-light badge
- Drop shadow below

### Bottom Nav
- White background, prominent top shadow
- Active item: red pill (#E31837) with white filled icon + label
- Inactive: grey icons + labels
- Sora 10px labels

### Icon Grid Tiles
- White cards, **16px radius**, prominent shadow
- 56px vibrant colored circles with white filled Material icons
- Sora 16px bold labels
- Red border on focus/hover (3px)

### Task Cards
- Prominent shadow, 16px radius
- Colored left border (4px) by priority
- Priority label in bold uppercase Sora

### Info/Alert Cards
- Red gradient background (#E31837 → #FF4D6A)
- White text, rounded 16px, shadow
- Arrow icon for actionable cards

### Forms
- Inputs: 56px height, 16px radius, warm-white background
- Labels: Sora 12px medium, uppercase
- Buttons: vivid red, shadow-md, Sora bold

### Empty States
- Personality copy (not generic "No items")
- Branded colors on the icon circle
- Encouraging action text

### Admin Sidebar
- Deep navy #1B2A4A background
- Red accent line or dot on active item (not white bg)
- Real logo at top
- Sora font throughout

---

## 4. Page-by-Page Changes

### Login
- Warm background with subtle red gradient wash at top
- Real S+ logo image (large, centered)
- "Who's working?" heading in Sora bold
- User grid: prominent shadow cards, vibrant avatar circles
- Role badges color-coded
- "Need help? Contact your manager" footer

### Hub Home
- Red header with white logo + notification bell
- Greeting with user name
- Red gradient info card ("X tasks need attention")
- 2x3 icon grid with vibrant circles + prominent shadows
- "More" section with additional tools
- Warm background throughout

### Tasks/Threads/Logbook/All List Pages
- Red header carries through
- Segmented tabs: red active, warm background
- Cards with prominent shadows
- FABs: vivid colors with shadow

### Admin Dashboard
- Navy sidebar with red active accent
- Stats cards with vivid icon backgrounds
- Red gradient for key metrics

### All Forms (Create Task, Thread, etc.)
- Sora labels, warm input backgrounds
- Red submit buttons with shadow
- Bottom sheets have warm white background

---

## 5. Missing Features to Build

### 5.1 Notification Triggers
Create notifications in existing mutations when:
- Task assigned → notify assignee
- Announcement created (CRITICAL/IMPORTANT) → notify all store staff
- Schedule published → notify all store staff
- Stock-out reported → notify all supervisors
- Critical incident logged → notify all managers
- Suggestion responded → notify author (if named)

Implementation: helper function `createNotification(db, userId, type, title, body?, link?)` called inside existing mutations.

### 5.2 Schedule Regenerate
Add `regenerate` mutation to schedules router:
- Takes `scheduleId` + optional `notes`
- Deletes existing draft slots
- Calls Claude again with updated notes
- Creates new slots
- Returns updated schedule

### 5.3 Training CRUD Pages
- `/admin/training/new` — create guide form (title, category, description, steps builder)
- `/admin/training/[id]` — edit guide (same form, pre-filled, update mutation)

Both pages follow existing admin form patterns with Sora font + red buttons.

### 5.4 Checklist History
- `/tools/closing-checklist/history` — supervisor+ view of past submissions
- Accordion list sorted by date, expandable to show items + reasons
- Reuse the existing `checklists.listSubmissions` query (currently only in admin)
- Add a `supervisorProcedure` version that scopes to own store

### 5.5 Report Metrics
Enhance the `reports` router:
- `taskPerformance`: add `topStaff` (top 5 by tasks completed)
- `checklistCompliance`: add `avgTime` (average submission hour)
- `stockAndExpiry`: add `avgRestockTime` (avg hours from reported → restocked)
- `incidents`: add `avgResolutionTime` (avg hours from open → resolved)

---

## 6. globals.css Overhaul

Replace the entire theme with:
```css
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');
@import "tailwindcss";

@source "../../../../packages/ui/src/**/*.tsx";
@source "../../../../packages/config/src/**/*.ts";

@theme {
  --color-brand: #E31837;
  --color-brand-dark: #B81430;
  --color-brand-light: #FF4D6A;
  --color-navy: #1B2A4A;
  --color-surface: #FFF8F6;
  --color-surface-white: #FFFFFF;
  --color-surface-cream: #FFF0EC;
  --color-on-surface: #1A1A2E;
  --color-on-surface-secondary: #6B7280;
  --color-outline: #D1D5DB;
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-on-brand: #FFFFFF;
  --color-on-navy: #FFFFFF;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 9999px;
  --shadow-card: 0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-card-hover: 0 4px 16px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-elevated: 0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
  --shadow-nav: 0 -2px 8px rgba(0,0,0,0.06);
}

body {
  font-family: 'Sora', system-ui, sans-serif;
  -webkit-tap-highlight-color: transparent;
  background-color: #FFF8F6;
}

.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  display: inline-block; line-height: 1; text-transform: none;
  letter-spacing: normal; word-wrap: normal; white-space: nowrap; direction: ltr;
}
.material-symbols-outlined.filled {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.brand-shadow {
  box-shadow: 0 4px 12px rgba(227, 24, 55, 0.25);
}
```

---

## 7. Implementation Order

1. **globals.css + design tokens** (foundation everything depends on)
2. **Shared components overhaul** (app-shell, bottom-nav, icon-grid, all cards, sidebar, notification-bell)
3. **Login page rebuild** (first impression)
4. **Hub home rebuild** (daily landing)
5. **All hub pages** (tasks, threads, logbook, announcements, profile, schedule, availability, promotions, training, suggestions)
6. **All tools pages** (pricing, product lookup, checklist, expiry, stock-out, incidents)
7. **Admin pages** (dashboard, people, products, categories, checklists, reports, schedules, suppliers, orders, promotions, training, suggestions)
8. **5 missing features** (notification triggers, schedule regenerate, training CRUD, checklist history, report metrics)
9. **PWA assets** (logo-based icons, updated manifest)
10. **Final audit + deploy**

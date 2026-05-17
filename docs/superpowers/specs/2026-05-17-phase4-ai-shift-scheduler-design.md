# Phase 4: AI Shift Scheduler — Design Spec

**Date:** 2026-05-17
**Status:** Approved
**Scope:** AI-generated shift schedules with manager review, staff availability, schedule viewing

---

## 1. Context

Managers currently create shift schedules manually (paper or WhatsApp). Phase 4 adds an AI-powered scheduler that generates weekly schedules based on store hours, staff availability, role requirements, and fairness history. Managers review and publish; staff see their schedule in the hub.

---

## 2. Data Model

### StoreConfig (extends Store)

Add fields to existing `Store` model:
```prisma
  openTime      String?   // "07:00"
  closeTime     String?   // "21:00"
  openDays      String?   // "Mon,Tue,Wed,Thu,Fri,Sat" (comma-separated)
```

### StaffAvailability

```prisma
model StaffAvailability {
  id        String @id @default(cuid())
  userId    String
  dayOfWeek Int    // 0=Sun, 1=Mon, ..., 6=Sat
  available Boolean @default(true)
  note      String? // "Can't do Sundays — church"

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, dayOfWeek])
  @@index([userId])
}
```

### ShiftSchedule

```prisma
model ShiftSchedule {
  id          String         @id @default(cuid())
  storeId     String
  weekStart   DateTime       @db.Date // Monday of the week
  status      ScheduleStatus @default(DRAFT)
  generatedBy String?        // "ai" or user ID who created manually
  aiPrompt    String?        // the prompt sent to Claude
  aiResponse  String?        // raw AI response for debugging
  publishedAt DateTime?
  publishedById String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  store       Store       @relation(fields: [storeId], references: [id])
  publishedBy User?       @relation("SchedulePublisher", fields: [publishedById], references: [id])
  slots       ShiftSlot[]

  @@unique([storeId, weekStart])
  @@index([storeId, weekStart])
}

enum ScheduleStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model ShiftSlot {
  id         String   @id @default(cuid())
  scheduleId String
  userId     String
  date       DateTime @db.Date
  startTime  String   // "07:00"
  endTime    String   // "15:00"
  role       String   // "STAFF", "SUPERVISOR", etc.

  schedule ShiftSchedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  user     User          @relation(fields: [userId], references: [id])

  @@index([scheduleId, date])
  @@index([userId, date])
}
```

---

## 3. AI Integration

### Claude API via Vercel AI SDK

**Package:** `@ai-sdk/anthropic` + `ai` (Vercel AI SDK)

**Flow:**
1. Manager opens scheduler → selects week → clicks "Generate with AI"
2. Server collects: store config (hours, days), active staff list with roles + availability, previous week's schedule (if exists), any manager notes
3. Sends structured prompt to Claude Sonnet (fast, cheap, good at structured output)
4. Claude returns JSON array of shift slots
5. Server validates + creates draft ShiftSchedule with slots
6. Manager sees visual grid, can edit, then publish

### Prompt Structure

```
You are a shift scheduler for a supermarket in Jamaica.

Store: {name}, open {openTime}-{closeTime}, days: {openDays}

Staff:
- {name} ({role}) — Available: Mon,Tue,Wed,Thu,Fri | Not available: Sat,Sun (church)
- {name} ({role}) — Available: all days
...

Requirements:
- At least 1 SUPERVISOR on every shift
- Maximum {hours} hours per staff per week
- Fair distribution — no one should get all weekends

{Previous week schedule if exists — for continuity}

{Manager notes if any — e.g., "Give Marcus more morning shifts"}

Generate a weekly schedule from {weekStart} to {weekEnd}.
Return ONLY a JSON array:
[
  { "userId": "...", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM", "role": "..." },
  ...
]
```

### Cost Estimate
- ~2000 tokens input, ~1000 tokens output per generation
- Claude Sonnet: ~$0.01 per generation
- Negligible cost

---

## 4. Manager UI

### Schedule Manager (`/admin/schedules`)

**Week selector:** Previous/Next week buttons with current week displayed

**Three states:**
1. **No schedule exists** — "Generate Schedule" button
2. **Draft** — visual grid with edit capability + "Publish" button
3. **Published** — read-only grid with "Create Next Week" button

### Visual Grid

A week-view calendar grid:
- Columns: Mon through Sun (or store's open days)
- Rows: time slots (morning, afternoon, evening — or continuous)
- Each cell shows staff name + role badge
- Color-coded by role (staff=grey, supervisor=navy, manager=amber)

For mobile: switch to day-by-day list view (one day at a time, swipe between days)

### Editing Draft
- Tap a slot → modal: change staff member (dropdown of available staff), change times
- "Add Slot" button per day → assign a staff member
- "Remove" button on each slot
- "Regenerate" button → calls AI again (clears current draft)
- Text input: "Adjustment notes" → sent to Claude with "modify the schedule: {notes}"

### Publishing
- "Publish Schedule" button → confirms → status changes to PUBLISHED, `publishedAt` set
- Published schedules are visible to staff in their profile

---

## 5. Staff UI

### My Schedule (in Profile or Hub)

**Route:** `/hub/schedule` (new hub page, also accessible from profile)

- Shows current week's published schedule for this staff member
- Simple list: Day, Start time, End time
- If no schedule published: "No schedule published for this week"

### Availability Management

**Route:** `/hub/availability` (accessible from profile)

- 7-day grid (Sun-Sat)
- Toggle available/unavailable per day
- Optional note per day
- Saves immediately on toggle

---

## 6. tRPC Routers

### `schedules` router
```
getWeek(weekStart) → schedule with slots (or null)
generate(weekStart, notes?) → draft schedule (calls Claude API) (manager+)
updateSlot(slotId, userId?, startTime?, endTime?) → slot (manager+)
addSlot(scheduleId, userId, date, startTime, endTime, role) → slot (manager+)
removeSlot(slotId) → void (manager+)
regenerate(scheduleId, notes?) → schedule (calls Claude again) (manager+)
publish(scheduleId) → schedule (manager+)
mySchedule(weekStart?) → slots for current user this week
```

### `availability` router
```
get() → availability records for current user (7 days)
update(dayOfWeek, available, note?) → availability record
```

### Store config
```
updateStoreConfig(openTime, closeTime, openDays) → store (manager+)
```
Add to existing `stores` router.

---

## 7. Routes

### Hub (staff)
```
/hub/schedule          → my shifts this week
/hub/availability      → manage my availability
```

### Admin (manager+)
```
/admin/schedules       → schedule manager (generate/edit/publish)
```

### Hub home icon grid update
Add "Schedule" icon to the grid (replacing or alongside "Profile")

### Admin sidebar
Add "Schedules" (icon: `calendar_month`)

---

## 8. Environment Variable

```
ANTHROPIC_API_KEY=sk-ant-...
```

Add to `.env` and Vercel env vars. Used by the AI generation endpoint.

---

## 9. Dependencies

```
@ai-sdk/anthropic    — Anthropic provider for Vercel AI SDK
ai                   — Vercel AI SDK core
```

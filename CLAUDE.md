# SuperPlus Platform

Internal operations platform for SuperPlus Food Stores (Jamaica). Replaces WhatsApp groups and paper with structured task management, communication, and operational tools.

## Stack

- Next.js 16 (App Router, Server Components)
- Prisma 7 + Neon PostgreSQL (`@prisma/adapter-neon`)
- NextAuth 5 (beta.30+) — phone+PIN credentials
- Tailwind v4
- tRPC for API layer
- Turborepo + pnpm monorepo
- Vercel hosting
- Workbox PWA (offline app shell)

## Architecture

Single Next.js app with subdomain middleware routing:
- `hub.*` → `/(hub)/*` — staff home base (tasks, threads, logbook, announcements)
- `admin.*` → `/(admin)/*` — management dashboard, cross-store view
- `tools.*` → `/(tools)/*` — calculator, product lookup, markup, checklists

Local dev: path-based (`localhost:3000/hub`). Subdomains on deployed environments only.

## Multi-Tenancy

Every record scoped by `store_id`. Middleware resolves store from session. All queries filter by store unless user has OWNER/MANAGER role viewing cross-store.

## Roles

```
OWNER      (4) — all stores, full admin
MANAGER    (3) — own store + admin dashboard
SUPERVISOR (2) — create tasks, manage checklists, logbook
STAFF      (1) — view/complete tasks, threads, log entries
```

## Auth

- Phone number + 4-digit PIN (no emails for floor staff)
- Long-lived sessions (30 days, JWT strategy)
- PIN reset by manager in-person
- 3 attempts then 30-second cooldown

## Design Philosophy

Staff are often undereducated. The UI must be:
- **Icon-first** — colored icons with 1-2 word labels, staff navigate by color/position
- **Big tap targets** — minimum 48px, forgiving of imprecise taps
- **Progressive disclosure** — simple action first, details optional behind a second tap
- **Familiar** — threads look like WhatsApp, lists like phone contacts
- **Status-driven color** — red=urgent, green=done, orange=attention. No decorative color.
- **One-handed** — primary actions in bottom half of screen on mobile

## Brand Tokens

```
primary:     #E31837 (SuperPlus red)
secondary:   #1B3A5C (navy)
accent:      #F5A623 (orange/warning)
success:     #2ECC71
danger:      #E74C3C
background:  #F8F9FA
surface:     #FFFFFF
text:        #1A1A2E / #6B7280

font-heading: Inter, system-ui
font-body:    system-ui
radius:       12px cards, 8px buttons, 6px inputs
```

## Monorepo Layout

```
apps/web/          — the Next.js app
packages/db/       — Prisma schema, client, typed queries
packages/ui/       — shared components (icon grid, cards, app shell)
packages/config/   — brand tokens, roles, constants
packages/ai/       — Claude API wrappers (shift scheduler, future)
```

## Conventions

- All DB queries go through `packages/db` — never raw Prisma calls in route handlers
- UI components in `packages/ui` — app-specific components live in the route group
- tRPC routers in `apps/web/src/server/routers/` — one router per domain (tasks, threads, etc.)
- Mutations always check role access + store scope before executing
- Prisma 7: import from generated path, not bare `node_modules/.prisma/client`
- Next.js 16: route params are Promises, must be awaited
- Tailwind v4: Google Fonts `@import` before `@import "tailwindcss"`

## Offline Strategy

- Workbox service worker: CacheFirst for static, NetworkFirst for API
- App shell always available offline
- Read-only cache of recent data (tasks, threads, logbook)
- Queued offline mutations flush on reconnect (last-write-wins)
- Visual offline indicator bar

## Build Phases

1. **Foundation + Hub** — scaffold, auth, middleware, tasks/threads/logbook/announcements, admin shell, PWA
2. **Core Tools** — calculator, product lookup, markup/margin, closing checklist
3. **Operational Intelligence** — expiry tracker, stock-out reporter, incident logger, reports
4. **AI & Scheduling** — Claude-powered shift scheduler, availability, fairness
5. **Supply Chain & Growth** — supplier orders, promotions, training/SOPs, suggestion box

## What NOT To Do

- Don't build features ahead of the current phase
- Don't add complexity for hypothetical scale (8 stores, not 800)
- Don't require email for staff accounts
- Don't use small text, subtle colors, or hover-only interactions
- Don't assume reliable internet — always consider offline gracefully
- Don't build separate deployments per app — it's one Next.js app with subdomain routing

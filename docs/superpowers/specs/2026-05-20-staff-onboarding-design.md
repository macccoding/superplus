# SuperPlus Staff Onboarding — Design Spec

## Context

SuperPlus Hub staff are often low-literacy. The app uses icon-first design with big tap targets, but there's no orientation when someone logs in for the first time. A manager creates their account, hands them a phone, and they're staring at an icon grid with zero context.

This spec defines a first-time onboarding experience and a "What's New" system for feature updates. Both are visual-first and audio-driven — text is supplementary, not primary.

---

## Decisions

| Decision | Choice |
|----------|--------|
| Voice | OpenAI TTS-1-HD, `nova` voice, standard English |
| Images | DALL-E 3, static first, animate with Sora later |
| Video | Skipped for now — architecture supports swapping `<img>` for `<video>` later |
| Mascot | **Keisha** — friendly Caribbean woman in red SuperPlus apron, calm helpful coworker |
| Slide layout | Classic Stack — image top 55%, content bottom 45%, clean split |
| Navigation | Swipe only, no Next button (except "Let's Go!" on final slide) |
| Walkthrough | Spotlight tour — dark overlay, spotlight hole, tooltip + audio per icon |
| What's New | Built alongside onboarding, same components, different mode |
| Who sees it | All roles (OWNER through STAFF) |
| Content mgmt | Static manifest — JSON committed to repo, generation script for assets |
| Design tool | Google Stitch for screen designs, exported as implementation reference |

---

## 1. Data Model

### User model additions (`packages/db/prisma/schema.prisma`)
```
onboardedAt       DateTime?
onboardingVersion Int       @default(0)
```

- `onboardedAt = null` → redirect to onboarding
- `onboardingVersion` tracks which version they've seen (0 = never)

### Version constant (`packages/config/src/onboarding.ts`)
```typescript
export const CURRENT_ONBOARDING_VERSION = 1;
```

### Manifest structure (one JSON per version)
```
apps/web/src/data/onboarding-v1.json   // orientation — 6 slides
apps/web/src/data/onboarding-v2.json   // first "What's New" (future)
```

```typescript
interface OnboardingManifest {
  version: number;
  type: 'orientation' | 'whats-new';
  title: string;
  generatedAt: string;
  slides: Array<{
    id: string;
    heading: string;
    subtext: string;
    icon: string;          // Material Symbol fallback
    color: string;         // Feature accent color
    imageUrl: string;      // Vercel Blob
    audioUrl: string;      // Vercel Blob
    narrationScript: string; // Accessibility text
  }>;
  walkthrough?: Array<{    // Only in orientation manifests
    id: string;
    target: string;        // data-walkthrough attribute value
    tooltip: string;
    audioUrl: string;
  }>;
}
```

### Backfill
One-shot script: all existing active users get `onboardedAt = NOW(), onboardingVersion = 1`. Only new users created after deployment see onboarding.

### tRPC changes (`apps/web/src/server/trpc/routers/users.ts`)
- `me` query: add `onboardedAt`, `onboardingVersion` to select
- New `completeOnboarding` mutation: sets `onboardedAt = now()`, updates `onboardingVersion`
- New `resetOnboarding` admin mutation: sets both fields back to null/0

---

## 2. Onboarding Slides (Stage 1)

### Layout
- Full-screen takeover: `fixed inset-0 z-50 bg-surface` — covers AppShell
- Image area: top 55%, background gradient tinted to slide's feature color
- Content area: bottom 45%, centered text + audio button
- Skip button: top-right, always visible, 48px+ target
- Progress dots: bottom, active dot uses slide's feature color
- Swipe: touch gesture, CSS `translateX` transitions (300ms ease-out)
- Only 3 slides in DOM at once (prev, current, next)
- Final slide: "Let's Go!" CTA button below audio button

### Audio button
- 56px circle, #E31837, white play/pause icon
- Animated SVG progress ring while playing
- "Tap to listen" hint below (disappears after first use)
- Pulses on slide 1 to teach the interaction
- Never autoplays (iOS Safari requires user gesture)

### Slide content

| # | ID | Heading | Subtext | Color | Icon | Keisha says |
|---|-----|---------|---------|-------|------|-------------|
| 1 | welcome | Welcome! | Your new work app | #E31837 | waving_hand | "Hey! I'm Keisha. Welcome to SuperPlus Hub — this is your new app for work. Let me show you around." |
| 2 | tasks | Tasks | See what needs doing | #446185 | assignment | "This is Tasks. When your manager gives you something to do, it shows up here. Tap to see it, mark it done when you're finished." |
| 3 | threads | Threads | Talk to your team | #2e7d32 | forum | "This is Threads — like a group chat for your store. Ask questions, share updates. No more missed messages." |
| 4 | logbook | Logbook | Write what happened | #845500 | history | "The Logbook is where you write down what happened on your shift. Anything the next person needs to know goes here." |
| 5 | tools | Tools | Calculator and more | #673ab7 | build | "These are your Tools — a calculator, product lookup, and other things to make your job easier." |
| 6 | ready | Ready! | You're all set | #E31837 | celebration | "That's it! You're all set. If you ever need to see this again, go to your Profile. Let's get started!" |

### DALL-E prompt strategy
- Every prompt includes Keisha's character anchor: "A friendly young Caribbean woman with warm brown skin, short natural hair, wearing a bright red SuperPlus apron over a white t-shirt, with a warm smile"
- Style anchor: "modern flat vector illustration, clean lines, warm palette"
- All prompts include "no text" to avoid hallucinated letters
- Brand colors embedded: #E31837 (red) and #1B2A4A (navy)
- 1024x1024, convert to WebP
- Generate all in one session for maximum consistency

### Image fallback
Each slide has `icon` + `color` fields. If DALL-E image hasn't loaded or fails, a large Material Symbol icon in a colored circle renders immediately.

---

## 3. Interactive Walkthrough (Stage 2)

### Trigger
"Let's Go!" on final slide → `completeOnboarding` mutation → navigate to `/hub?walkthrough=1`

### Spotlight mechanism
- Overlay: `fixed inset-0 z-[60]` with `bg-black/60`
- Spotlight hole via CSS `clip-path` revealing target icon
- Targets identified by `data-walkthrough` attributes on IconGrid items
- Position via `getBoundingClientRect()`

### Steps

| Step | Target | Tooltip | Keisha says |
|------|--------|---------|-------------|
| 1 | Tasks icon | "Your tasks are here" | "Tap this whenever you need to see what's assigned to you." |
| 2 | Threads icon | "Chat with your team" | "Tap here to talk to your team or read what's going on." |
| 3 | Logbook icon | "Write your shift notes" | "Before you leave, tap here and write what happened." |
| 4 | Tools icon | "Calculator and more" | "Need to do a quick calculation? It's right here." |

### Interaction
- Tooltip card near spotlighted icon (above/below depending on position)
- 40px audio button in tooltip
- "Got it" button advances to next step
- "Skip tour" link always visible at bottom
- Final step "Got it" dismisses overlay entirely

### State
- Client-side only — `sessionStorage` prevents reappear on refresh
- Does NOT affect `onboardedAt` or `onboardingVersion`
- Does not resume if user navigates away mid-tour

---

## 4. "What's New" System

### Same components, different mode
`OnboardingFlow` accepts `type: 'orientation' | 'whats-new'`

### Trigger
`user.onboardingVersion > 0 && user.onboardingVersion < CURRENT_ONBOARDING_VERSION`

### UI differences

| | Orientation | What's New |
|---|---|---|
| First slide | "Hey! I'm Keisha." | "What's New!" |
| Slide count | 6 | 1-3 per update |
| Close button | Subtle "Skip" | Prominent X top-right |
| Final button | "Let's Go!" | "Got It!" |
| Walkthrough after? | Yes | No |
| Mascot tone | "Let me show you around" | "Hey, we added something cool" |

### Adding a release (future workflow)
1. Add slide definitions to generation script under new version
2. Run `pnpm generate:onboarding --version 2`
3. Bump `CURRENT_ONBOARDING_VERSION` to 2
4. Commit manifest, deploy

---

## 5. Asset Generation Pipeline

### Script (`scripts/generate-onboarding-assets.ts`)
Run with `pnpm generate:onboarding [--version N]`

Three steps:
1. **DALL-E 3 images** — pre-written prompts with Keisha's character description, upload to Vercel Blob at `onboarding/v{N}/{slide-id}.png`, convert to WebP
2. **TTS-1-HD audio** — narration scripts, `nova` voice, MP3, upload to Vercel Blob at `onboarding/v{N}/{slide-id}.mp3`. 6 slide clips + 4 walkthrough clips for v1.
3. **Manifest writer** — combines URLs into `onboarding-v{N}.json`, writes to `apps/web/src/data/`

### Cost per run
~$0.24 images + ~$0.15 audio = under $0.50 total

### Future video upgrade
Architecture supports adding `videoUrl` field to manifest alongside `imageUrl`. Component checks video first, falls back to image. Generate with Sora (image-to-video) when ready.

---

## 6. Stitch Integration

Used during implementation for design, not at runtime:

1. Create Stitch project "SuperPlus Onboarding"
2. Set up design system: primary #E31837, secondary #1B2A4A, Sora font, 12px roundness, light mode
3. `batch_generate_screens` for all mobile mockups:
   - 6 orientation slides (showing Keisha placeholder + text + audio button layout)
   - Walkthrough overlay with spotlight
   - "What's New" variant
   - Profile page with "Learn the App" button
4. Export design tokens and component code as implementation reference
5. Stitch designs are the source of truth for how screens should look

---

## 7. Routing & Guards

### Hub layout guard (`apps/web/src/app/hub/layout.tsx`)
```
if (me && !me.onboardedAt && pathname !== '/hub/onboarding') → redirect to /hub/onboarding
if (me && me.onboardingVersion < CURRENT_VERSION && pathname !== '/hub/onboarding') → redirect
```

### Onboarding page always renders
Navigating to `/hub/onboarding` works regardless of `onboardedAt` — enables replay from profile.

### Post-login chain
Login → `/` → middleware redirects to `/hub` → layout guard redirects to `/hub/onboarding` (if needed)

---

## 8. Admin & Replay

- **Profile page**: "Learn the App" button between "My Availability" and "Store Alerts" — navigates to `/hub/onboarding`
- **Admin**: `resetOnboarding` mutation lets managers force a user back through onboarding
- **Walkthrough replay**: Profile also has option to navigate to `/hub?walkthrough=1`

---

## 9. Service Worker & Offline

- Onboarding page HTML precached in service worker install event
- Vercel Blob assets (images + audio) cached on first access via CacheFirst strategy
- Prefetch after login: background-fetch all manifest URLs into cache
- Offline `completeOnboarding` mutation queues for replay on reconnect

---

## 10. Edge Cases

- **Interrupted onboarding**: `onboardedAt` still null, restarts from slide 1 on next visit (~30 seconds, fine to restart)
- **Multiple devices**: Server-side fields, complete on phone → skip on tablet
- **Offline first login**: Impossible — PIN auth requires server
- **iOS audio**: Requires user gesture, play button tap satisfies this
- **Slow images**: Material Symbol icon placeholder renders immediately, image loads behind it
- **New user created by admin**: Gets defaults (null/0), sees onboarding on first login
- **What's New during active session**: Only checks on hub home page navigation, not every layout render

---

## File Structure

### New files
```
apps/web/src/app/hub/onboarding/
  page.tsx                        -- Server component, loads manifest
  onboarding-flow.tsx             -- Client: carousel + state machine
  onboarding-slide.tsx            -- Single slide: image, heading, subtext, audio
  onboarding-audio-button.tsx     -- 56px play/pause with progress ring
  onboarding-progress.tsx         -- Dot indicators
  onboarding-walkthrough.tsx      -- Spotlight overlay for real hub
  use-onboarding-audio.ts         -- Hook: play/pause/progress via HTML5 Audio

apps/web/src/data/
  onboarding-v1.json              -- Generated manifest

scripts/
  generate-onboarding-assets.ts   -- Main orchestrator
  onboarding/
    slides.ts                      -- Slide definitions (prompts, narration)
    generate-images.ts             -- DALL-E 3 → Vercel Blob
    generate-audio.ts              -- TTS-1-HD → Vercel Blob
    manifest.ts                    -- TypeScript types

packages/config/src/
  onboarding.ts                   -- CURRENT_ONBOARDING_VERSION export
```

### Modified files
```
packages/db/prisma/schema.prisma          -- Add onboardedAt, onboardingVersion to User
apps/web/src/server/trpc/routers/users.ts -- me select, completeOnboarding, resetOnboarding
apps/web/src/app/hub/layout.tsx           -- Onboarding redirect guard
apps/web/src/app/hub/page.tsx             -- data-walkthrough attrs, walkthrough overlay
apps/web/src/app/hub/profile/page.tsx     -- "Learn the App" replay button
apps/web/public/sw.js                     -- Onboarding asset caching rules
packages/config/src/index.ts              -- Re-export onboarding constant
package.json (root)                       -- generate:onboarding script
```

---

## Implementation Phases

### Phase A: Foundation
1. Schema fields + migration + backfill
2. `users.me` select update
3. `completeOnboarding` + `resetOnboarding` mutations
4. `CURRENT_ONBOARDING_VERSION` constant
5. Hub layout redirect guard

### Phase B: Stitch Design
1. Create Stitch project with SuperPlus design system
2. Batch generate all onboarding screen designs (mobile)
3. Export as implementation reference

### Phase C: Asset Pipeline
1. Script directory structure + slide definitions
2. DALL-E image generation + Blob upload
3. TTS audio generation + Blob upload
4. Manifest writer
5. Generate v1 assets, commit manifest

### Phase D: Onboarding UI
1. `useOnboardingAudio` hook
2. `OnboardingAudioButton` component
3. `OnboardingSlide` component
4. `OnboardingProgress` dots
5. `OnboardingFlow` orchestrator
6. `/hub/onboarding/page.tsx` route
7. "Learn the App" button on profile page

### Phase E: Walkthrough
1. `data-walkthrough` attributes on IconGrid items
2. Spotlight overlay + tooltip components
3. `OnboardingWalkthrough` orchestrator
4. Generate walkthrough audio clips
5. Wire up `?walkthrough=1` trigger

### Phase F: What's New
1. `type` prop on `OnboardingFlow` — orientation vs whats-new
2. Conditional UI: heading, close button, final CTA
3. Manifest loader: determine which version(s) to show
4. Update generation script for `--version N` flag

### Phase G: Polish
1. Service worker caching for onboarding assets
2. Asset prefetch after login
3. Test on real devices (low-end Android, iOS Safari)
4. Verify offline behavior

---

## Verification

1. Create test user via admin → first login redirects to onboarding
2. Swipe through all 6 slides, verify images + audio
3. "Let's Go!" → marks complete → redirects to `/hub?walkthrough=1`
4. Walkthrough spotlights each icon in sequence
5. Profile > "Learn the App" replays orientation
6. Log out and back in → no onboarding (already complete)
7. Bump version constant → next login shows "What's New"
8. Test on mobile device, especially audio on iOS Safari
9. Kill network mid-onboarding → slides render from cache

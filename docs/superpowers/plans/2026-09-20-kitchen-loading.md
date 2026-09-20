# Kitchen Loading Implementation Plan

**Goal:** Remove tab-return loading resets and add the approved cookie illustration.
**Architecture:** A small session-profile controller owns deduplication, cancellation and loading state; UserProvider subscribes to Supabase events and publishes state. A standalone SVG/CSS component renders initial loading.
**Tech Stack:** Existing React, Supabase, CSS modules and Vitest.

## Constraints
Preserve current uncommitted security work. No new dependencies, commit or deployment. The profile endpoint remains authoritative. Reduced motion disables animation.

- [x] Add controller regression tests covering duplicate sign-in, background refresh, account changes, sign-out races, authorization errors, transient errors, disposal and timeout. Run `npm test -- src/lib/userSession.test.ts` and confirm failure before implementation.
- [x] Implement `src/lib/userSession.ts` and wire `src/lib/userContext.tsx` to INITIAL_SESSION and subsequent auth events. Deduplicate same-user sign-ins; cancel stale requests and clear on sign-out. Run focused tests.
- [x] Create `src/app/components/KitchenLoading.tsx` and its CSS module. Replace the boxed loading text in HomePageContent. Use accessible status text and decorative SVG, a restrained 1.8-second rock, staggered crumbs and reduced-motion override.
- [x] Run `npm test`, `npx tsc --noEmit`, `npm run build`, and ESLint on changed source. Inspect browser rendering at desktop and mobile sizes, animation and reduced motion. Review only task changes against the starting snapshot.

## Verification results

186 tests passed across 29 files, including 14 session lifecycle tests. Type check, production build and scoped ESLint passed. Desktop (1280px) and mobile (390px) component previews rendered without console errors. Reduced-motion CSS was inspected; OS-level reduced-motion emulation was not available. The full app reached its expected login screen; authenticated Safari tab switching remains a manual verification gap. Review identified a dropped mid-request token/profile update; restarting obsolete requests now covers that race with regression tests.

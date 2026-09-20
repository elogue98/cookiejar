# Cookie Jar Security-First Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace profile-picker trust with authenticated family identity, enforce least-privilege database and storage access, and harden every server trust boundary against spoofing, SSRF, upload abuse, and paid-provider exhaustion.

**Architecture:** Use Supabase SSR cookie sessions for browser/server access, a separate service-role client only for explicitly privileged operations, and a database mapping from Auth users to the existing family profile UUIDs. Shared route helpers will perform authentication, origin, validation, rate-limit, and safe-error handling before any external call or mutation. Supabase RLS remains the final authorization boundary, with private image storage and short-lived signed URLs.

**Tech Stack:** Next.js 16 App Router, Supabase Auth/SSR/Postgres/Storage, React 19, Zod, Vitest, Sharp, OpenAI Chat Completions with schema validation, Google Places.

## Global Constraints

- Upgrade Next.js to `16.3.2`, React/React DOM to `19.2.8`, Sharp to `0.35.3`, Vitest to `4.1.11`, Supabase JS to `2.112.3`, OpenAI to `6.49.0`, and add `@supabase/ssr@0.12.4`.
- The app is family-only; anonymous pages redirect to `/login` and APIs return `401`.
- Authenticated users must map to an existing family profile before access; unmapped users are denied and signed out.
- Write identity fields are never accepted from request bodies; attribution comes from the verified server mapping.
- Service-role access is limited to rate limiting and explicit one-time account linking.
- Remote fetches allow only safe HTTP(S) destinations, revalidate redirects, time out after 10 seconds, and enforce streaming byte limits.
- Images require signature, encoded-size, and decoded-dimension validation before Sharp processing.
- Expensive routes must reject rate-limited requests before starting external calls and return `Retry-After` with `429`.
- Errors exposed to clients use `{ success: false, error: string, code: string }` without internal details.
- Do not commit, deploy, enable external deployment protection, or run state-changing import/link/migration scripts automatically.

### Task 1: Secure Supabase clients and authenticated identity

**Files:**
- Create: `src/lib/supabase/browser.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`
- Create: `src/lib/auth.ts`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/logout/route.ts`
- Create: `src/proxy.ts`
- Modify: `src/lib/supabaseClient.ts`
- Modify: `src/lib/userContext.tsx`
- Modify: `src/app/login/page.tsx`
- Test: `src/lib/auth.test.ts`

**Deliverable:** cookie-aware SSR auth, a verified `requireFamilyProfile()` helper, no localStorage identity authority, and a PKCE callback/logout flow.

### Task 2: Auth schema and one-time linking tooling

**Files:**
- Create: `supabase/migrations/20260823000000_create_user_auth_links.sql`
- Create: `scripts/link-auth-profile.ts`
- Modify: `README.md`
- Test: `scripts/link-auth-profile.test.ts`

**Deliverable:** unique profile/Auth mapping preserving the existing UUIDs and an explicit `--profile-id --email` linking command that never stores or commits email addresses.

### Task 3: Database/storage authorization

**Files:**
- Create: `supabase/migrations/20260823000100_security_rls_and_storage.sql`
- Create: `supabase/migrations/20260823000200_private_recipe_images.sql`
- Create: `src/lib/imageUrls.ts`
- Modify: server components and recipe/place read paths
- Test: `src/lib/imageUrls.test.ts`

**Deliverable:** RLS/grants, protected attribution, private `recipe-images`, `image_path`, and one-hour signed URLs.

### Task 4: Common API security boundary

**Files:**
- Create: `src/lib/apiErrors.ts`
- Create: `src/lib/apiSecurity.ts`
- Create: `src/lib/validation.ts`
- Modify: every route under `src/app/api/**/route.ts`
- Modify: `src/app/train/highlights/page.tsx` and `src/app/api/highlights/route.ts`
- Test: `src/lib/apiSecurity.test.ts`, route matrices alongside existing route tests

**Deliverable:** auth/origin/error contracts, bounded Zod inputs, forged identity rejection, safe failure responses, and production trainer exclusion.

### Task 5: Safe remote retrieval and image/text limits

**Files:**
- Create: `src/lib/safeFetch.ts`
- Create: `src/lib/imageValidation.ts`
- Modify: URL/image import routes and shared image processing
- Test: `src/lib/safeFetch.test.ts`, `src/lib/imageValidation.test.ts`

**Deliverable:** DNS-aware SSRF defense, redirect/timeout/stream limits, content-type checks, image signature/dimension checks, and bounded HTML/AI/chat input.

### Task 6: Atomic rate limiting and provider protection

**Files:**
- Create: `supabase/migrations/20260823000300_create_rate_limit_rpc.sql`
- Create: `src/lib/rateLimit.ts`
- Modify: provider-backed routes
- Test: `src/lib/rateLimit.test.ts`

**Deliverable:** atomic profile-scoped windows, `Retry-After`, and no external call after a rejected limit check.

### Task 7: Dependencies, structured-output cleanup, verification, and docs

**Files:**
- Modify: `package.json`, `package-lock.json`, `next.config.ts`, `README.md`, `docs/DEPLOYMENT.md`, OpenAI route schemas
- Test: all existing and new Vitest tests

**Deliverable:** requested dependency floors, security headers/CSP, schema-backed model output where supported, audit/build/test/lint/type checks, browser checks when runtime credentials are available, and a rollout checklist.

## Verification Commands

```bash
npm test
npx tsc --noEmit
npm run lint
npm run build
npm audit --audit-level=high
```

Each slice must also run its focused tests and inspect the final diff for secrets, unrelated changes, generated files, and unexecuted state-changing scripts.

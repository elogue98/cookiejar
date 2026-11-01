# Hidden Password Login Implementation Plan

**Goal:** Let Eoin enter through a hidden password-only form using his existing account.

**Architecture:** Server-only email/profile configuration, normal Supabase cookie sessions, existing linked-profile authorization and database-backed rate limiting. Provide password setup only to the configured, already authenticated profile.

**Constraints:** Preserve current dirty files. No commits, deployment, dependencies or migrations. Work inline on codex/hidden-password-login.

- [x] Add failing route tests for missing config, malformed input, foreign origins, throttling, valid password, invalid password, unlinked/wrong-profile accounts and transient failures. Add proxy reachability tests for `/admin/login` and `/auth/admin/login`.
- [x] Implement configuration helper and POST `/auth/admin/login`. Validate origin, bounded JSON password, configuration and rate limit before `signInWithPassword`; verify `requireFamilyProfile` matches configuration, sign out failed partial sessions and return no-store responses with generic errors.
- [x] Add failing setup tests for configured profile authorization and update failures. Implement POST `/api/auth/admin-password`, authenticated `/admin/password` and password-only `/admin/login` forms. Add no-index metadata, accessible errors, loading states and fixed navigation after successful sign-in.
- [x] Update proxy exact public paths and keep hidden login reachable during unlinked-account recovery. Document server config and one-time password setup in README.
- [x] Run targeted tests, full tests, TypeScript, lint and production build. Check desktop/mobile entry and error interactions in the browser. Review final diff and report setup/deployment gaps.

## Verification

261 tests across 39 files passed. TypeScript, lint, production build and diff whitespace checks passed. Browser checks covered desktop (1280px), mobile (390px), pending/disabled submission, missing-configuration errors, email fallback and anonymous setup-page protection. No browser warnings/errors were captured.

Live setup and successful login remain unverified: the locally configured Supabase hostname fails DNS resolution (`ENOTFOUND`). A read-only lookup could not resolve Eoin's linked account. No environment file, remote account or password was changed; the two server-only configuration values still need to be supplied for the actual account. The password remains for the user to choose through `/admin/password`. Changes are local, uncommitted and undeployed on `codex/hidden-password-login`.

## Authorized production rollout

The user subsequently requested deployment and live testing. Supabase had been paused on Free; the user resumed it, and health checks recovered to HTTP 200. Read-only account lookup resolved Eoin's existing linked Auth account. Added ADMIN_LOGIN_EMAIL and ADMIN_LOGIN_PROFILE_ID as sensitive production environment values and to ignored local configuration. No password or remote account was changed.

Live testing exposed strict RFC UUID validation rejecting the existing PostgreSQL profile identifier. A failing regression test reproduced the issue; canonical UUID-shape validation now matches the existing account-linking tool. All 265 tests across 40 files, TypeScript, lint, local build and Vercel build passed afterwards.

Final production deployment: https://cookiejar-hl0shkkly-eoin-logues-projects.vercel.app (canonical https://cookiejar-nine.vercel.app). Live browser checks covered desktop/mobile, loading and incorrect-password recovery, email fallback and anonymous setup-page denial. HTTP checks confirmed no account identity in entry-page HTML, anonymous profile/setup 401, foreign-origin 403, invalid-input 400 and no-store errors. Runtime rate limiting was exercised by the incorrect-password check. No browser warnings/errors were captured.

The user must choose their own password at /admin/password after signing in once. Successful password setup and sign-in remain a manual verification gap. No commits or pushes were made. Temporary production secrets were removed after verification.

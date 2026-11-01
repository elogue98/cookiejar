# CookieBot streaming implementation plan

Approved design: docs/superpowers/specs/2026-10-24-cookiebot-streaming-design.md.

Work inline on the existing feature branch to preserve uncommitted authentication work. The follow-up request authorizes Vercel deployment and a modern streaming renderer; no commits or pushes requested.

- [x] Write failing tests for SSE decoding (fragmented UTF-8, completion, interruption, safe errors and cancellation), provider streaming lifecycle and Luna request shape. Implement dedicated CookieBot Responses API helpers with reasoning none, bounded outputs, no stored responses, abort propagation and no automatic fallback. Keep shared ai.ts unchanged.
- [x] Test and switch the assistant route to authenticated SSE while retaining validation and rate limits. Switch only recipe-mutate's model helper to Luna with the existing structured-output schema and validation.
- [x] Test pure conversation-history and change-preview helpers. Replace automatic mutation intent with explicit proposal generation and Apply/Cancel controls. Preserve structured recipe fields and existing PUT/versioning. Keep partial/stopped/error messages out of future model history.
- [x] Build the warm responsive chat panel, safe formatted text, suggestions, Stop/Retry/Copy, expanded mode, keyboard controls, minimized conversation preservation, reader-controlled scrolling and live status announcements. Use existing React/CSS only.
- [x] Verify model access and a few representative live recipe questions without saving recipe changes. Run full Vitest, TypeScript, lint and build. Browser-check desktop/mobile streaming, stop/retry, scrolling, proposal/cancel, errors and reduced-motion styles. Review the final diff and report remaining gaps.

## Verification and review

293 tests across 47 files passed. TypeScript, clean ESLint, production build and diff whitespace checks passed. No production dependencies or shared AI defaults changed.

Confirmed access to gpt-6-luna using the configured account. Live requests through the local authenticated assistant route streamed 36–83 deltas for three initial recipe questions, with first text around 1.1–2.8 seconds. A structured half-batch proposal correctly halved flour and servings. Browser checks also exposed the original grounding prompt refusing sensible substitutions; the scoped prompt now distinguishes proposed substitutions from original recipe facts, and Luna supplied practical yogurt quantities and texture guidance in a subsequent check.

Browser QA: 1280px desktop and 390px mobile, real streaming, Stop with preserved partial answer, Retry, drafting during a run, minimise/reopen preserving state, expand/collapse, reader-controlled scrolling/jump to latest, structured before/after previews and Cancel. The mobile sheet fit within the viewport with no horizontal overflow. Captured preview: /tmp/cookiebot-luna-refresh.png. No chat console errors; one existing recipe-image LCP warning remains.

A SHA-256 fingerprint of the persisted title, ingredients, instructions, tags and servings matched before/after chat, previews and cancellation. Comparing whole API responses is unsuitable because signed image URLs vary. Apply transport is unit-tested, including structured instructions, servings and invalid-output rejection; no actual saved-recipe write was executed. Clipboard permissions, a physical mobile keyboard, actual assistive technology and OS-level reduced-motion emulation were not exercised; reduced-motion CSS was inspected.

An existing sign-in fallback submitted a password in the URL before hydration in one local test. Added native POST actions to both password forms and a regression guard. No password appears in source/docs; the temporary browser tabs are ephemeral, and generated development logs were checked for the test password. Local preview needed a restart of this chat's old October 21 dev server; the replacement runs via npm run dev.

Self-review covered abort propagation, stream completion/error framing, Unicode/coalesced chunks, word-group display, no automatic fallback, bounded history, escaped model text, explicit save boundaries, servings previews, current Next.js async route params and preservation of pre-existing work. Changes remain uncommitted and undeployed on the existing feature branch.

## Follow-up: Streamdown and production rollout

Added pinned Streamdown 2.7.1 for streaming-aware Markdown and 160ms per-word fades using the official animation, configuration and security documentation. The prose element allowlist excludes images and links, raw HTML is skipped, default sanitization remains active, and reduced-motion CSS disables word/list-marker animations. Browser inspection confirmed active sd-fadeIn word spans during a real response and zero word spans after Stop. A browser check caught that the initial prose allowlist also removed animation spans; allowing sanitized spans and strengthening the test to match actual spans fixed it.

295 tests pass, including numbering, partial Markdown, animation lifecycle, blocked model HTML/images and unsafe links. Desktop and 390px mobile checks passed with no horizontal overflow or console errors. The existing dependency audit reports issues in pre-existing packages (including Next.js); Streamdown's added dependency tree has no reported advisories. Framework upgrades are outside this chat-polish change.

Production deployment succeeded at https://cookiejar-56popyvp4-eoin-logues-projects.vercel.app and was aliased to https://cookiejar-nine.vercel.app. Live browser verification passed existing password sign-in, real Luna streaming with active word fades, completion with animation wrappers removed, correct half-batch quantities/servings, structured before/after proposal and Cancel, expand/collapse, compact desktop and 390px mobile. Production console had zero errors. No recipe save was performed; Apply remains transport-unit-tested. Screenshot: /tmp/cookiebot-vercel-desktop.png. All 295 tests, TypeScript, lint and the local/remote production builds passed. Source remains uncommitted on the existing feature branch; deployment used the authorized working tree.

# Agent Guidance For cookiejar

Use the shared guidance in `/Users/eoinlogue/AGENTS.md` plus these repo-specific rules.

## Project Shape
- Next.js 16 app using Supabase, OpenAI, Google Places/Maps, and Vitest.
- Use the `NEXT_FORCE_WEBPACK=1` scripts already defined in this repo.

## Commands
- Development: `npm run dev`.
- Tests: `npm test`.
- Lint: `npm run lint`.
- Type check: `npx tsc --noEmit`.
- Production build: `npm run build`.

## Implementation Rules
- Verify API route handler signatures and route params against Next.js 16 async params behavior before editing routes.
- Treat migrations and environment variables carefully.
- Do not expose keys, tokens, or private values.
- Use `openai-docs` for OpenAI API, SDK, or model work.
- Inspect the installed OpenAI SDK version and current official documentation before changing models, request shapes, tool calls, or structured outputs.
- Do not run data import, labeling, training, migration, or other state-changing scripts unless explicitly requested.

## Verification
- Use `browser:control-in-app-browser` for UI checks, screenshots, local smoke tests, and visual QA when practical.
- For UI changes, check desktop and mobile widths, changed interactions, loading/error states, and the browser console.
- When touching API routes, route types, OpenAI integration, Supabase integration, or shared infrastructure, run `npm test`, `npx tsc --noEmit`, and `npm run build`.
- Work is done when the changed workflow succeeds, expected failure states remain safe, relevant checks pass, and no secrets or unintended database changes appear in the diff.

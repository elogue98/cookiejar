# Photo Import Review Implementation Plan

**Goal:** Preserve source content from multiple photos and require review before saving.

**Architecture:** A dedicated structured vision extractor replaces the image endpoint's OCR/text chain. The modal retains ordered photos and an extracted draft, and renders a separate review component. Existing finalize/storage handling remains, with source warnings limited to the review screen.

**Tech Stack:** Next.js 16.3.2, OpenAI SDK 6.49.0 Chat Completions, GPT-6 Luna (one call, medium reasoning, no fallback), Zod, Sharp, React, Vitest.

## Constraints

- Preserve unrelated dirty work; no new dependencies or database migrations.
- Keep combined multipart bytes below Vercel's 4.5 MB limit; budget images at 3 MB total and the saved first image at 2 MB maximum.
- No invented instructions or unlabelled handwritten overrides. No nutrition/time estimates in image extraction.
- Official references: https://developers.openai.com/api/docs/guides/images-vision and https://developers.openai.com/api/docs/guides/structured-outputs .

## Tasks

1. Write failing extraction/route tests for multi-photo input, preserved quantity/section output, review flags, refusal, truncation, invalid files and excessive photo counts. Implement `src/lib/imageRecipeExtraction.ts`; simplify `src/app/api/import/image/route.ts` and disable AI unit rewriting for image finalization.
2. Write failing compression-budget and tests preventing diagnostic notes from being saved. Add per-image byte budget support to `src/lib/importImage.ts`, and explicit review/source-note validation to `src/lib/validation.ts` and `src/app/api/import/image/finalize/route.ts`.
3. Add `src/app/components/ImageImportReview.tsx`. Update `ImportRecipeModal.tsx` for up to six photos, ordered selection/removal, review/acknowledgement, back-to-photos, save loading/error states, and clear reset/cancellation behavior.
4. Run actual extraction on the supplied first photo and both photos; inspect quantities, complete gravy steps, handwritten notes, and warning behavior. Repair the requested saved recipe with a local backup and conditional update to avoid overwriting concurrent edits.
5. Run full Vitest, TypeScript, lint and build; verify review UI on desktop/mobile using a temporary local browser harness without bypassing live authentication. Review diffs, update the isolated deployment snapshot with only this task's files, deploy, and verify the production alias.

Execute sequentially in this shared worktree because the existing production source includes uncommitted user work. Do not commit or push unrelated work.

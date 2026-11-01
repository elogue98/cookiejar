# Faithful photo imports

User confirmed missing content should be flagged; the supplied second photo contains the continuation and gravy method.

- Accept up to six ordered photos of one recipe, including later-page continuations. Compress all photos to a combined 3 MB upload budget; retain the first photo as the recipe image.
- Extract directly from all images with a single GPT-6 Luna call at medium reasoning with original image detail. Keep the existing Chat Completions SDK architecture. Remove the lossy OCR-to-text normalization chain for this endpoint.
- Require structured recipe fields, review warnings, and source notes. Preserve quantities, alternatives, sections, and instruction order. Never invent missing methods or merge adjacent recipes. Conflicting handwritten corrections remain explicit notes requiring review.
- Always show the extracted ingredients, method, source notes, and warnings before saving. If warnings exist, require explicit acknowledgement. Returning to photos retains selected pages and allows adding/removing pages.
- Keep source notes and review warnings in the import review screen only. Save only an actual recipe description as notes; never append import diagnostics. Preserve existing authentication, rate limits, image validation, URL imports, and text imports.
- Correct only the requested recipe, from both supplied photos, preserving uncertainty about the handwritten oven temperature. Back up the exact prior row locally before updating.
- Verify mocked boundary failures, real-image extraction for one and two pages, desktop/mobile review interactions, full tests, types, lint, build, and production deployment. No automatic guarantee of perfect OCR; human review remains necessary.

Cost constraint confirmed by user: one Luna call only, maxRetries 0, no fallback/escalation or duplicate crops. Human review and source photo comparison replace the second model pass.

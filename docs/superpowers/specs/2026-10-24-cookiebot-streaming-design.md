# CookieBot streaming and visual refresh — proposed design

## Verified current state

Production model settings checked read-only on 24 October 2026: primary `gpt-4o-mini`, fallback `gpt-4o`. Installed OpenAI SDK: 6.49.0. No API inference calls were made and no settings changed during research.

`src/app/api/assistant/route.ts` awaits a complete Chat Completions result and returns JSON. `src/app/components/CookieBot.tsx` shows loading dots and inserts the complete answer. The existing popup is 384px wide and 500px tall; both speakers use colored bubbles. The component scrolls to the bottom whenever messages change. Mutation detection matches substrings including `swap` and `replace`, then saves the generated result and reloads the page.

## Recommended interaction and appearance

Retain Cookie Jar's warm cream, charcoal and muted red palette. Use a 420–440px desktop floating panel with a compact header, recipe title as context, and a mobile sheet that respects the keyboard and safe areas. Keep the launcher small and close/expand controls clearly labeled. Use a lighter border, restrained shadow, comfortable text and a composer integrated with the panel.

Replace the empty-state bullet list with a short greeting and three clickable suggestions: ingredient substitutions, serving adjustments and step explanations. Assistant replies use the full readable content width; user messages use a compact contrasting bubble. Render paragraphs, lists and emphasis safely as partial text arrives, with no raw HTML execution.

Stream actual provider output through the authenticated server route. Show a quiet waiting indicator until the first text arrives, then reveal small word groups without deliberately delaying the result. Do not reanimate already-rendered content. Include Stop, retry and copy actions. Preserve interrupted text and label it as incomplete. Stop cancels the underlying request; closing/minimizing the panel preserves its conversation state. Respect reduced motion and announce completed responses accessibly rather than every token.

Auto-follow only when the reader is already near the bottom. Scrolling up pauses following and reveals a small jump-to-latest control. Use scrolling scoped to the conversation, rather than scrollIntoView on the recipe document. Keep the composer usable for drafting while a reply streams.

Recipe adjustments become proposals with a compact change preview and explicit Apply/Cancel controls. Questions containing `swap` or `replace` must not save automatically. Preserve existing authorization, validation, rate limits and recipe versioning. Do not change the cooking prompt's personality or factual constraints beyond what is needed to support readable output and proposals.

## Alternatives considered

1. Recommended: improve the existing React component and OpenAI SDK streaming. Smallest architectural change; custom rendering and stream lifecycle need focused tests.
2. Adopt assistant-ui primitives for messages, composer, streaming and scrolling. More built-in behavior, but adds production dependencies and integration work; separate approval required.
3. Make the assistant a permanently docked side panel. Better for long conversations, but takes space from the recipe; reserve an optional expanded mode rather than make it the default.

Use current assistant-ui and AI SDK patterns as references, without installing a chat framework by default. AI Elements currently announces migration to shadcn/ui and deprecation at the end of November 2026; do not add it as a new standalone dependency.

## Model recommendation and costs

Test `gpt-6-luna` as CookieBot's dedicated model, initially with no or low reasoning effort to assess responsiveness. Keep the shared import/tagging model configuration unchanged. A stronger fallback can be evaluated separately; retry only before any answer text has reached the user, so a mid-stream failure cannot duplicate or silently replace an answer. Keep fallback behavior visible in internal usage metadata without logging private recipe/chat content.

Standard short-context USD prices per million tokens, checked 24 October 2026:

| Model | Uncached input | Output |
| --- | ---: | ---: |
| GPT-4o mini (current primary) | $0.15 | $0.60 |
| GPT-6 Luna (candidate) | $0.10 | $0.50 |
| GPT-4o (current fallback) | $2.50 | $10.00 |

Example assumption: 2,000 uncached input tokens and 500 billed output tokens per reply, 1,000 replies. Costs are $0.60, $0.45 and $10.00 respectively. These are illustrative calculations, not measured usage. Context growth, reasoning tokens, cache behavior and processing tiers can change actual bills. Model quality, account availability and latency have not been benchmarked.

## Implementation and verification scope

After design approval, write the implementation plan and add meaningful tests for chunk boundaries, partial UTF-8/SSE data, cancellation, disconnects, safe errors and no fallback after emitted output. Test suggestion handling and explicit recipe-change application. Verify the existing model-dependent request parameters against official documentation before any migration; changing a model name alone is insufficient.

Run npm test, npx tsc --noEmit, npm run lint and npm run build. Browser-check desktop and mobile, a real streamed answer, stop/retry, reader-controlled scrolling, safe markdown, keyboard access and failure states. Use deterministic fake streams for most tests. Compare candidate models on a small approved recipe-question set before choosing a final model. Preserve current uncommitted authentication and other work. No dependency installation, commit, push or deployment is included without authorization for this work.

## Sources

- OpenAI model: https://developers.openai.com/api/docs/models/gpt-6-luna
- OpenAI pricing: https://developers.openai.com/api/docs/pricing
- OpenAI streaming: https://developers.openai.com/api/docs/guides/streaming-responses
- AI SDK stream smoothing: https://ai-sdk.dev/docs/ai-sdk-core/generating-text
- assistant-ui scroll ownership: https://www.assistant-ui.com/elements/scroll-anchor
- AI Elements message rendering and migration notice: https://elements.ai-sdk.dev/components/message
- AI Elements composer patterns: https://elements.ai-sdk.dev/components/prompt-input

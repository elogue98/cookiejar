# Kitchen loading

Approved direction: keep recipes visible during same-user session notifications. Initial loading uses a small golden cookie progressively eaten in five bites, with falling crumbs after each bite and “Getting your kitchen ready…”. The cookie has softly shaded baked edges, irregular chocolate chunks and subtle texture, with restrained bite movement. No separate three-dot indicator. Reduced motion shows a still illustration. Use SVG and CSS without dependencies.

Auth events supply session identity; the existing server profile endpoint remains the authorization authority. Duplicate sign-in events do not fetch again once loaded. Token refresh and user updates revalidate in the background. Sign-out and account changes clear stale content immediately. Cancel obsolete requests and bound profile loading to ten seconds. Preserve loaded profiles on transient background errors; authorization failures still clear and redirect.

Verify event behavior and request races with Vitest, then run the full test suite, type check, build, scoped lint, and desktop/mobile browser checks. Preserve existing uncommitted work. No commit or deployment.

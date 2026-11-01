# Hidden password sign-in

User correction: password-only entry, signing in as Eoin.

Add an unlinked `/admin/login` page with one password field. The server obtains the account email from `ADMIN_LOGIN_EMAIL` and the expected existing family profile UUID from `ADMIN_LOGIN_PROFILE_ID`. Authenticate through Supabase Auth and verify the returned linked profile matches the configured UUID. No shared-password auth bypass or additional admin privileges.

Use the existing database-backed rate limiter before password authentication: ten attempts per ten minutes and fifty per day, shared across this entrance. Reject foreign origins, oversized/malformed requests and invalid configuration. Return generic invalid-password errors without exposing account identity. Fail closed on service failures; avoid cached auth responses.

Add an authenticated `/admin/password` page so Eoin can set the password after signing in once by email. Its API checks the linked profile against the configured UUID before updating only the currently authenticated user's own Supabase password. Other profiles are denied. Normal email sign-in remains unchanged.

Preserve existing uncommitted work. No dependencies, migrations, administrative account mutations, commits or deployment. Verify route/session/error behavior with Vitest, full tests, type check, lint, build and desktop/mobile browser checks. Live password setup/sign-in is not verified without the user's chosen password.

# Cookie Jar security rollout

The hardening changes are code- and migration-ready, but the database migrations and account-linking command are intentionally manual. Apply them only after a backup and a reviewed maintenance window.

1. Enable Vercel Deployment Protection for the deployment before exposing the new auth boundary.
2. Confirm the public Supabase URL/key, service-role key, OpenAI key, Google Maps key, and `NEXT_PUBLIC_APP_URL` are configured in the target environment. The service-role key is server-only.
3. Confirm the existing root-level schema migrations have already been applied. They are the repository's legacy schema history; the new security migrations depend on those `users`, recipe, ratings, comments, place, and storage tables. For a fresh database, apply those files in dependency order: `migration_create_users_table.sql`, `migration_create_places_tables.sql`, `migration_create_ratings_table.sql`, `migration_create_comments_table.sql`, `migration_create_recipe_versions_table.sql`, `migration_create_place_ratings_table.sql`, `migration_add_created_by_to_recipes.sql`, `migration_add_cookbook_source.sql`, `migration_add_recipe_metadata.sql`, `migration_add_notes_to_places.sql`, `migration_update_place_ratings_decimal.sql`, and `migration_update_places_status_check.sql`.
4. From a checkout initialized for the Supabase CLI, apply the security migrations in order with `npx supabase db push`:
   - `supabase/migrations/20260823000000_create_user_auth_links.sql`
   - `supabase/migrations/20260823000100_security_rls_and_storage.sql`
   - `supabase/migrations/20260823000200_private_recipe_images.sql`
   - `supabase/migrations/20260823000300_create_rate_limit_rpc.sql`
5. Invite the three family Auth accounts, then explicitly link each invited account with `scripts/link-auth-profile.ts` using its profile UUID and email. Do not put the email addresses in source control or logs.
6. Run `supabase/tests/security_hardening.sql` with pgTAP enabled. If this checkout has not been initialized for the Supabase CLI, run `npx supabase init` locally, then link the target with `npx supabase link --project-ref <project-ref>`; do not commit the generated project reference or credentials. Run `npx supabase db test --linked` and confirm the anonymous grants, family policies, attribution triggers, rate-limit privileges, and private storage policies.
7. Verify magic-link login, unmapped-account denial, signed recipe images, ratings, comments, recipe/place collaboration, imports, and 429 responses in the protected deployment.
8. Remove the temporary deployment gate only after the checks pass.

These steps are not run automatically by the application or test suite.

## Pre-deployment review findings (2026-09-20)

This branch is a saved work-in-progress snapshot. Resolve these findings before production rollout:

- `src/lib/supabase/proxy.ts` redirects every valid session away from `/login`, while `requireFamilyPage` redirects missing profile mappings and auth-configuration errors to `/login`. Server-component sign-out cannot persist cookie deletion, so these cases can loop between the home page and login. Keep error/login recovery reachable and add a redirect regression test.
- `rate_limit_counters` keys rows by profile, bucket and window start without window duration. Hourly and daily windows coincide at UTC midnight and increment the same counter twice. Include window duration in counter identity throughout the RPC, with a database regression test for aligned windows.

The local suite, type check, lint and build pass. The SQL migration suite and authenticated production workflow have not been verified as part of this commit.

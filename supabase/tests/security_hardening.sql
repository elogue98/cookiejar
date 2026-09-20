-- pgTAP verification for the security migrations.
-- Run against a Supabase project after applying the four security migrations:
--   supabase db test --linked
-- or execute this file in a transaction with the pgTAP extension enabled.
-- These checks are intentionally read-only; the application rollout still
-- requires the backup, account linking, and signed-image checks in the docs.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(45);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.user_auth_links'::regclass),
  'auth mappings have RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.rate_limit_counters'::regclass),
  'rate-limit counters have RLS enabled'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.users'::regclass),
  'users has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.recipes'::regclass),
  'recipes has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ratings'::regclass),
  'ratings has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.comments'::regclass),
  'comments has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.recipe_versions'::regclass),
  'recipe_versions has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.places'::regclass),
  'places has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.place_ratings'::regclass),
  'place_ratings has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.place_lists'::regclass),
  'place_lists has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.place_list_items'::regclass),
  'place_list_items has RLS enabled'
);

SELECT is(has_table_privilege('anon', 'public.users', 'SELECT'), false, 'anon cannot select users');
SELECT is(has_table_privilege('anon', 'public.recipes', 'SELECT'), false, 'anon cannot select recipes');
SELECT is(has_table_privilege('anon', 'public.ratings', 'SELECT'), false, 'anon cannot select ratings');
SELECT is(has_table_privilege('anon', 'public.comments', 'SELECT'), false, 'anon cannot select comments');
SELECT is(has_table_privilege('anon', 'public.recipe_versions', 'SELECT'), false, 'anon cannot select recipe history');
SELECT is(has_table_privilege('anon', 'public.places', 'SELECT'), false, 'anon cannot select places');
SELECT is(has_table_privilege('anon', 'public.place_ratings', 'SELECT'), false, 'anon cannot select place ratings');
SELECT is(has_table_privilege('anon', 'public.user_auth_links', 'SELECT'), false, 'anon cannot select auth mappings');
SELECT is(has_table_privilege('anon', 'public.rate_limit_counters', 'SELECT'), false, 'anon cannot select rate-limit counters');
SELECT is(has_table_privilege('anon', 'public.place_lists', 'SELECT'), false, 'anon cannot select place lists');
SELECT is(has_table_privilege('anon', 'public.place_list_items', 'SELECT'), false, 'anon cannot select place list items');
SELECT is(has_table_privilege('authenticated', 'public.user_auth_links', 'SELECT'), true, 'authenticated can read only their auth mapping');

SELECT is(
  has_function_privilege('authenticated', 'private.current_family_profile_id()', 'EXECUTE'),
  false,
  'authenticated cannot execute the membership helper directly'
);
SELECT is(
  has_function_privilege('anon', 'private.current_family_profile_id()', 'EXECUTE'),
  false,
  'anon cannot execute the membership helper directly'
);
SELECT is(
  has_function_privilege('anon', 'public.consume_rate_limits(uuid,text,jsonb)', 'EXECUTE'),
  false,
  'anon cannot execute the rate limiter'
);
SELECT is(
  has_function_privilege('authenticated', 'public.consume_rate_limits(uuid,text,jsonb)', 'EXECUTE'),
  false,
  'authenticated cannot execute the rate limiter'
);
SELECT is(
  has_function_privilege('service_role', 'public.consume_rate_limits(uuid,text,jsonb)', 'EXECUTE'),
  true,
  'service_role can execute the rate limiter'
);
SELECT is(
  has_function_privilege('authenticated', 'private.set_recipe_attribution()', 'EXECUTE'),
  false,
  'authenticated cannot execute recipe attribution directly'
);
SELECT is(
  has_function_privilege('authenticated', 'private.set_user_attribution()', 'EXECUTE'),
  false,
  'authenticated cannot execute user attribution directly'
);
SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid = 'private.current_family_profile_id()'::regprocedure),
  'membership helper is security definer'
);
SELECT ok(
  (SELECT array_to_string(proconfig, ',') LIKE '%search_path=%'
   FROM pg_proc WHERE oid = 'private.current_family_profile_id()'::regprocedure),
  'membership helper pins search_path'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ratings'
      AND policyname = 'ratings_own_insert'
      AND with_check LIKE '%user_id%auth.uid%'
  ),
  'rating inserts derive identity from auth.uid'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comments'
      AND policyname = 'comments_own_update'
      AND qual LIKE '%user_id%auth.uid%'
  ),
  'comment updates are restricted to the caller profile'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'place_ratings'
      AND policyname = 'place_ratings_own_insert'
      AND with_check LIKE '%user_id%auth.uid%'
  ),
  'place-rating inserts derive identity from auth.uid'
);
SELECT ok(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (
        'users_family_select', 'recipes_family_select', 'ratings_family_select',
        'comments_family_select', 'versions_family_select', 'places_family_select',
        'place_ratings_family_select'
      )
  ) = 7,
  'all application tables have family read policies'
);
SELECT ok(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (
        'recipes_family_insert', 'recipes_family_update', 'recipes_family_delete',
        'places_family_insert', 'places_family_update', 'places_family_delete',
        'place_lists_family_insert', 'place_lists_family_update', 'place_lists_family_delete',
        'place_list_items_family_insert', 'place_list_items_family_update', 'place_list_items_family_delete'
      )
  ) = 12,
  'collaborative write policies exist for shared records'
);
SELECT ok(
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (
        'ratings_own_insert', 'ratings_own_update', 'ratings_own_delete',
        'comments_own_insert', 'comments_own_update', 'comments_own_delete',
        'versions_own_insert',
        'place_ratings_own_insert', 'place_ratings_own_update', 'place_ratings_own_delete'
      )
  ) = 10,
  'attribution write policies exist for ratings comments versions and place ratings'
);
SELECT is(
  (
    SELECT count(*)
    FROM pg_trigger
    WHERE tgrelid IN (
      'public.recipes'::regclass, 'public.ratings'::regclass, 'public.comments'::regclass,
      'public.recipe_versions'::regclass, 'public.place_ratings'::regclass
    )
      AND NOT tgisinternal
      AND tgname IN (
        'recipes_set_attribution', 'ratings_set_attribution', 'comments_set_attribution',
        'versions_set_attribution', 'place_ratings_set_attribution'
      )
  ),
  5::bigint,
  'attribution triggers protect all caller-owned fields'
);

SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'recipe-images'),
  false,
  'recipe-images is private'
);
SELECT ok(
  COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass), false)
  AND NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND 'anon' = ANY(roles)
  ),
  'anon cannot select storage objects through RLS'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'recipe_images_family_select'
      AND qual LIKE '%bucket_id%recipe-images%'
  ),
  'private image reads are restricted to the recipe bucket and family'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'recipe_images_family_insert'
      AND with_check LIKE '%recipes/%'
  ),
  'private image writes are restricted to recipe paths'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'recipe_images_family_update'
      AND with_check LIKE '%bucket_id%recipe-images%'
  ),
  'private image updates are restricted to recipe paths'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'recipe_images_family_delete'
      AND qual LIKE '%bucket_id%recipe-images%'
  ),
  'private image deletes are restricted to recipe paths'
);

SELECT * FROM finish();
ROLLBACK;

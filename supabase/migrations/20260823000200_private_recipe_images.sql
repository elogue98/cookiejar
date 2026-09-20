-- Move recipe images to private storage while retaining image_url for rollback.
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS image_path TEXT;

ALTER TABLE public.recipes DISABLE TRIGGER recipes_set_attribution;

UPDATE public.recipes
SET image_path = regexp_replace(
  split_part(image_url, '?', 1),
  '^.*/storage/v1/object/public/recipe-images/',
  ''
)
WHERE image_path IS NULL
  AND image_url IS NOT NULL
  AND image_url LIKE '%/storage/v1/object/public/recipe-images/%';

ALTER TABLE public.recipes ENABLE TRIGGER recipes_set_attribution;

CREATE INDEX IF NOT EXISTS idx_recipes_image_path ON public.recipes(image_path);

INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-images', 'recipe-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS recipe_images_family_select ON storage.objects;
DROP POLICY IF EXISTS recipe_images_family_insert ON storage.objects;
DROP POLICY IF EXISTS recipe_images_family_update ON storage.objects;
DROP POLICY IF EXISTS recipe_images_family_delete ON storage.objects;

CREATE POLICY recipe_images_family_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND name ~* '^recipes/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp|gif)$'
    AND EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()))
  );
CREATE POLICY recipe_images_family_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recipe-images'
    AND name ~* '^recipes/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp|gif)$'
    AND EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()))
  );
CREATE POLICY recipe_images_family_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND name ~* '^recipes/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp|gif)$'
    AND EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'recipe-images'
    AND name ~* '^recipes/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp|gif)$'
    AND EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()))
  );
CREATE POLICY recipe_images_family_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'recipe-images'
    AND name ~* '^recipes/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp|gif)$'
    AND EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()))
  );

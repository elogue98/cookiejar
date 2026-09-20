-- Security boundary for the family-only application.
-- Apply after the existing root schema migrations and 20260823000000_create_user_auth_links.sql.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.current_family_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT link.profile_id
  FROM public.user_auth_links AS link
  WHERE link.auth_user_id = (SELECT auth.uid())
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.current_family_profile_id() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_list_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.users, public.recipes, public.ratings, public.comments,
  public.recipe_versions, public.places, public.place_ratings,
  public.place_lists, public.place_list_items FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recipes, public.places TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ratings, public.comments, public.place_ratings TO authenticated;
GRANT SELECT, INSERT ON TABLE public.recipe_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.place_lists, public.place_list_items TO authenticated;

DROP POLICY IF EXISTS users_family_select ON public.users;
CREATE POLICY users_family_select ON public.users
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS recipes_family_select ON public.recipes;
DROP POLICY IF EXISTS recipes_family_insert ON public.recipes;
DROP POLICY IF EXISTS recipes_family_update ON public.recipes;
DROP POLICY IF EXISTS recipes_family_delete ON public.recipes;
CREATE POLICY recipes_family_select ON public.recipes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY recipes_family_insert ON public.recipes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY recipes_family_update ON public.recipes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY recipes_family_delete ON public.recipes
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS ratings_family_select ON public.ratings;
DROP POLICY IF EXISTS ratings_own_insert ON public.ratings;
DROP POLICY IF EXISTS ratings_own_update ON public.ratings;
DROP POLICY IF EXISTS ratings_own_delete ON public.ratings;
CREATE POLICY ratings_family_select ON public.ratings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY ratings_own_insert ON public.ratings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT link.profile_id FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()) LIMIT 1));
CREATE POLICY ratings_own_update ON public.ratings
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT link.profile_id FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()) LIMIT 1))
  WITH CHECK (user_id = (SELECT link.profile_id FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()) LIMIT 1));
CREATE POLICY ratings_own_delete ON public.ratings
  FOR DELETE TO authenticated
  USING (user_id = (SELECT link.profile_id FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()) LIMIT 1));

DROP POLICY IF EXISTS comments_family_select ON public.comments;
DROP POLICY IF EXISTS comments_own_insert ON public.comments;
DROP POLICY IF EXISTS comments_own_update ON public.comments;
DROP POLICY IF EXISTS comments_own_delete ON public.comments;
CREATE POLICY comments_family_select ON public.comments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY comments_own_insert ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT link.profile_id FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()) LIMIT 1));
CREATE POLICY comments_own_update ON public.comments
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT link.profile_id FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()) LIMIT 1))
  WITH CHECK (user_id = (SELECT link.profile_id FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()) LIMIT 1));
CREATE POLICY comments_own_delete ON public.comments
  FOR DELETE TO authenticated
  USING (user_id = (SELECT link.profile_id FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()) LIMIT 1));

DROP POLICY IF EXISTS versions_family_select ON public.recipe_versions;
DROP POLICY IF EXISTS versions_own_insert ON public.recipe_versions;
CREATE POLICY versions_family_select ON public.recipe_versions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY versions_own_insert ON public.recipe_versions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT link.profile_id FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()) LIMIT 1));

DROP POLICY IF EXISTS places_family_select ON public.places;
DROP POLICY IF EXISTS places_family_insert ON public.places;
DROP POLICY IF EXISTS places_family_update ON public.places;
DROP POLICY IF EXISTS places_family_delete ON public.places;
CREATE POLICY places_family_select ON public.places
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY places_family_insert ON public.places
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY places_family_update ON public.places
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY places_family_delete ON public.places
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS place_lists_family_select ON public.place_lists;
DROP POLICY IF EXISTS place_lists_family_insert ON public.place_lists;
DROP POLICY IF EXISTS place_lists_family_update ON public.place_lists;
DROP POLICY IF EXISTS place_lists_family_delete ON public.place_lists;
CREATE POLICY place_lists_family_select ON public.place_lists
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY place_lists_family_insert ON public.place_lists
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY place_lists_family_update ON public.place_lists
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY place_lists_family_delete ON public.place_lists
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS place_list_items_family_select ON public.place_list_items;
DROP POLICY IF EXISTS place_list_items_family_insert ON public.place_list_items;
DROP POLICY IF EXISTS place_list_items_family_update ON public.place_list_items;
DROP POLICY IF EXISTS place_list_items_family_delete ON public.place_list_items;
CREATE POLICY place_list_items_family_select ON public.place_list_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY place_list_items_family_insert ON public.place_list_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY place_list_items_family_update ON public.place_list_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY place_list_items_family_delete ON public.place_list_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS place_ratings_family_select ON public.place_ratings;
DROP POLICY IF EXISTS place_ratings_own_insert ON public.place_ratings;
DROP POLICY IF EXISTS place_ratings_own_update ON public.place_ratings;
DROP POLICY IF EXISTS place_ratings_own_delete ON public.place_ratings;
CREATE POLICY place_ratings_family_select ON public.place_ratings
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid())));
CREATE POLICY place_ratings_own_insert ON public.place_ratings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT link.profile_id FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()) LIMIT 1));
CREATE POLICY place_ratings_own_update ON public.place_ratings
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT link.profile_id FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()) LIMIT 1))
  WITH CHECK (user_id = (SELECT link.profile_id FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()) LIMIT 1));
CREATE POLICY place_ratings_own_delete ON public.place_ratings
  FOR DELETE TO authenticated
  USING (user_id = (SELECT link.profile_id FROM public.user_auth_links AS link WHERE link.auth_user_id = (SELECT auth.uid()) LIMIT 1));

CREATE OR REPLACE FUNCTION private.set_recipe_attribution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_id UUID;
BEGIN
  profile_id := (SELECT private.current_family_profile_id());
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'family profile required';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := profile_id;
  ELSIF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'recipe attribution cannot change';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recipes_set_attribution ON public.recipes;
CREATE TRIGGER recipes_set_attribution
  BEFORE INSERT OR UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION private.set_recipe_attribution();

CREATE OR REPLACE FUNCTION private.set_user_attribution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_id UUID;
BEGIN
  profile_id := (SELECT private.current_family_profile_id());
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'family profile required';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := profile_id;
  ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user attribution cannot change';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ratings_set_attribution ON public.ratings;
CREATE TRIGGER ratings_set_attribution
  BEFORE INSERT OR UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION private.set_user_attribution();
DROP TRIGGER IF EXISTS comments_set_attribution ON public.comments;
CREATE TRIGGER comments_set_attribution
  BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION private.set_user_attribution();
DROP TRIGGER IF EXISTS versions_set_attribution ON public.recipe_versions;
CREATE TRIGGER versions_set_attribution
  BEFORE INSERT OR UPDATE ON public.recipe_versions
  FOR EACH ROW EXECUTE FUNCTION private.set_user_attribution();
DROP TRIGGER IF EXISTS place_ratings_set_attribution ON public.place_ratings;
CREATE TRIGGER place_ratings_set_attribution
  BEFORE INSERT OR UPDATE ON public.place_ratings
  FOR EACH ROW EXECUTE FUNCTION private.set_user_attribution();

REVOKE ALL ON FUNCTION private.set_recipe_attribution() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.set_user_attribution() FROM PUBLIC, anon, authenticated;

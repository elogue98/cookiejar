-- Link a verified Supabase Auth user to one of the existing family profile UUIDs.
-- Run this migration before inviting/linking family accounts.
CREATE TABLE IF NOT EXISTS public.user_auth_links (
  profile_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_auth_links_auth_user_id
  ON public.user_auth_links(auth_user_id);

ALTER TABLE public.user_auth_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_auth_links_select_own ON public.user_auth_links;
CREATE POLICY user_auth_links_select_own
  ON public.user_auth_links
  FOR SELECT
  TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.user_auth_links FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_auth_links TO authenticated;

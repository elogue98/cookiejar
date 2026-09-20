-- Atomic, profile-scoped rate limiter. The RPC is callable only by service_role.
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  profile_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (profile_id, bucket, window_start)
);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rate_limit_counters FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_rate_limits(
  p_profile_id UUID,
  p_bucket TEXT,
  p_windows JSONB
)
RETURNS TABLE (allowed BOOLEAN, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_window JSONB;
  window_seconds INTEGER;
  window_limit INTEGER;
  window_start_at TIMESTAMPTZ;
  current_count INTEGER;
  request_allowed BOOLEAN := TRUE;
  retry_after INTEGER := 1;
  now_at TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_profile_id IS NULL OR p_bucket IS NULL OR length(p_bucket) = 0 OR p_windows IS NULL OR jsonb_typeof(p_windows) <> 'array' THEN
    RAISE EXCEPTION 'invalid rate limit arguments';
  END IF;

  -- Serialize all windows for a profile/bucket so concurrent requests cannot
  -- both pass a boundary check before either increments the counter.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_profile_id::TEXT || ':' || p_bucket, 0)
  );

  FOR current_window IN SELECT value FROM jsonb_array_elements(p_windows)
  LOOP
    window_seconds := (current_window ->> 'seconds')::INTEGER;
    window_limit := (current_window ->> 'limit')::INTEGER;
    IF window_seconds IS NULL OR window_limit IS NULL OR window_seconds < 1 OR window_seconds > 86400 OR window_limit < 1 THEN
      RAISE EXCEPTION 'invalid rate limit window';
    END IF;
    window_start_at := to_timestamp(
      floor(extract(epoch FROM now_at) / window_seconds) * window_seconds
    );
    INSERT INTO public.rate_limit_counters (profile_id, bucket, window_start, request_count)
    VALUES (p_profile_id, p_bucket, window_start_at, 0)
    ON CONFLICT (profile_id, bucket, window_start) DO NOTHING;
  END LOOP;

  FOR current_window IN SELECT value FROM jsonb_array_elements(p_windows)
  LOOP
    window_seconds := (current_window ->> 'seconds')::INTEGER;
    window_limit := (current_window ->> 'limit')::INTEGER;
    window_start_at := to_timestamp(
      floor(extract(epoch FROM now_at) / window_seconds) * window_seconds
    );
    SELECT request_count INTO current_count
    FROM public.rate_limit_counters
    WHERE profile_id = p_profile_id AND bucket = p_bucket AND window_start = window_start_at
    FOR UPDATE;

    IF current_count + 1 > window_limit THEN
      request_allowed := FALSE;
      retry_after := GREATEST(
        retry_after,
        CEIL(extract(epoch FROM (window_start_at + make_interval(secs => window_seconds) - now_at)))::INTEGER
      );
    END IF;
  END LOOP;

  IF request_allowed THEN
    FOR current_window IN SELECT value FROM jsonb_array_elements(p_windows)
    LOOP
      window_seconds := (current_window ->> 'seconds')::INTEGER;
      window_start_at := to_timestamp(
        floor(extract(epoch FROM now_at) / window_seconds) * window_seconds
      );
      UPDATE public.rate_limit_counters
      SET request_count = request_count + 1
      WHERE profile_id = p_profile_id AND bucket = p_bucket AND window_start = window_start_at;
    END LOOP;
  END IF;

  DELETE FROM public.rate_limit_counters
  WHERE profile_id = p_profile_id AND bucket = p_bucket AND window_start < now_at - INTERVAL '2 days';

  RETURN QUERY SELECT request_allowed, retry_after;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limits(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limits(UUID, TEXT, JSONB) TO service_role;

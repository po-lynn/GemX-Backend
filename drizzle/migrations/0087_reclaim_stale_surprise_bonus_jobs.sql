-- Surprise Bonus queue: reclaim jobs stranded in "processing" after a serverless
-- function is killed mid-batch (Vercel `maxDuration` timeout, cold-start crash, etc.).
-- Previously claim_background_job() only looked at status = 'pending', so a job
-- interrupted by a hard timeout (no catchable JS exception, so failOrRetryJob()
-- never runs) stayed "processing" forever and was invisible to every future
-- claim attempt (after() retry or Vercel Cron) -- the campaign got stuck at
-- 0 processed. This reclaims any "processing" job whose lock is older than
-- 3 minutes (comfortably longer than a single 100-user batch takes) so cron /
-- the next request can pick it back up. grant_surprise_bonus_user() is
-- idempotent per (user, campaign), so a rare reclaim of a job that was still
-- genuinely in-flight cannot double-credit a user.
--> statement-breakpoint

CREATE OR REPLACE FUNCTION claim_background_job(p_type text, p_locked_by text)
RETURNS SETOF background_jobs
LANGUAGE plpgsql
AS $$
DECLARE
  v_id text;
BEGIN
  SELECT j.id INTO v_id
  FROM background_jobs j
  WHERE j.type = p_type
    AND (
      (j.status = 'pending' AND j.available_at <= now())
      OR (j.status = 'processing' AND j.locked_at < now() - interval '3 minutes')
    )
  ORDER BY j.available_at ASC, j.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE background_jobs
  SET
    status = 'processing',
    attempts = attempts + 1,
    locked_at = now(),
    locked_by = p_locked_by,
    last_error = NULL
  WHERE id = v_id
  RETURNING *;
END;
$$;

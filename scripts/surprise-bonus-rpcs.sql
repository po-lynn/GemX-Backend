-- Copy of RPCs from 0081_surprise_bonus_queue.sql for manual Supabase SQL editor use.
-- Prefer running: npm run db:migrate

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
    AND j.status = 'pending'
    AND j.available_at <= now()
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

CREATE OR REPLACE FUNCTION grant_surprise_bonus_user(p_campaign_id text, p_user_id text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_points integer;
  v_name text;
  v_created_by text;
  v_tx_id text;
BEGIN
  SELECT points_per_user, name, created_by
  INTO v_points, v_name, v_created_by
  FROM surprise_bonus_campaign
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF v_points IS NULL THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'campaign_not_found');
  END IF;

  BEGIN
    v_tx_id := gen_random_uuid()::text;
    INSERT INTO point_transaction (
      id, user_id, type, direction, amount, status,
      reference_id, reference_type, description, created_by, created_at
    ) VALUES (
      v_tx_id,
      p_user_id,
      'surprise_bonus',
      'credit',
      v_points,
      'completed',
      p_campaign_id,
      'surprise_bonus_campaign',
      'Surprise bonus: ' || v_name,
      v_created_by,
      now()
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('granted', false, 'reason', 'already_granted');
  END;

  UPDATE "user"
  SET
    points = points + v_points,
    points_lifetime = points_lifetime + v_points
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    DELETE FROM point_transaction WHERE id = v_tx_id;
    RETURN jsonb_build_object('granted', false, 'reason', 'user_not_found');
  END IF;

  INSERT INTO app_notification (
    id, user_id, type, title, message, data, is_read, created_at
  ) VALUES (
    gen_random_uuid()::text,
    p_user_id,
    'surprise_bonus',
    v_name || ' 🎁',
    'You received ' || v_points::text || ' surprise bonus points!',
    jsonb_build_object('campaignId', p_campaign_id),
    false,
    now()
  );

  RETURN jsonb_build_object('granted', true, 'points', v_points);
END;
$$;

-- Run manually on Supabase production after migrate (service_role exists there):
-- GRANT EXECUTE ON FUNCTION claim_background_job(text, text) TO service_role;
-- GRANT EXECUTE ON FUNCTION grant_surprise_bonus_user(text, text) TO service_role;

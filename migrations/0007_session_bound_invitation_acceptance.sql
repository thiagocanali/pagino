-- The acceptance executor can validate a session and consume an invitation,
-- but has no direct access to either the authentication or membership tables.
CREATE ROLE invitation_acceptor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE invitation_acceptor_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT invitation_acceptor TO invitation_acceptor_login WITH INHERIT FALSE, SET TRUE;
GRANT USAGE ON SCHEMA pagino TO invitation_acceptor;

CREATE FUNCTION pagino.accept_initial_owner_invitation_for_session(p_session_token text, p_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user_id text;
BEGIN
  IF p_session_token IS NULL OR p_session_token = '' THEN
    RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE = '22023';
  END IF;

  -- Lock the user first, matching the order of account recovery.
  SELECT u.id INTO v_user_id
  FROM pagino_auth."user" AS u
  JOIN pagino_auth.session AS s ON s.user_id = u.id
  WHERE s.token = p_session_token AND s.expires_at > clock_timestamp()
  FOR SHARE OF u;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE = '22023';
  END IF;

  -- Recheck after acquiring the user lock. Keep the session stable through acceptance.
  PERFORM 1 FROM pagino_auth.session AS s
  WHERE s.token = p_session_token AND s.user_id = v_user_id
    AND s.expires_at > clock_timestamp()
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE = '22023';
  END IF;

  RETURN pagino.accept_initial_owner_invitation(v_user_id, p_token_hash);
END;
$$;

REVOKE ALL ON FUNCTION pagino.accept_initial_owner_invitation_for_session(text,text)
  FROM PUBLIC, app_runtime, auth_runtime, public_reader, provision_operator;
GRANT EXECUTE ON FUNCTION pagino.accept_initial_owner_invitation_for_session(text,text)
  TO invitation_acceptor;

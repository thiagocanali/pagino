-- Check registration eligibility without exposing invitations or allowing membership writes.
CREATE FUNCTION pagino.can_register_initial_owner(p_token_hash text, p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pagino.initial_owner_invitations AS invitation
    JOIN pagino.institutions AS institution ON institution.id = invitation.institution_id
    WHERE invitation.token_hash = p_token_hash AND invitation.recipient_email = p_email
      AND invitation.delivery_status = 'sent' AND invitation.used_at IS NULL
      AND invitation.expires_at > clock_timestamp() AND institution.status = 'active'
  );
$$;
REVOKE ALL ON FUNCTION pagino.can_register_initial_owner(text,text)
  FROM PUBLIC, app_runtime, auth_runtime, public_reader, provision_operator;
GRANT EXECUTE ON FUNCTION pagino.can_register_initial_owner(text,text) TO invitation_acceptor;

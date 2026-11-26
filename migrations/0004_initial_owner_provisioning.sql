-- TASK 04-C: operational bootstrap. Apply only to an explicitly authorized, disposable PG first.
-- This migration does not grant provisioning powers to app_runtime or auth_runtime.
CREATE ROLE provision_operator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE TABLE pagino.initial_owner_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES pagino.institutions(id),
  recipient_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  encrypted_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT initial_owner_invitation_delivery CHECK (delivery_status IN ('pending','sent','failed')),
  CONSTRAINT initial_owner_invitation_email CHECK (recipient_email = lower(recipient_email) AND length(recipient_email) <= 254),
  CONSTRAINT initial_owner_invitation_expiry CHECK (expires_at > created_at),
  CONSTRAINT initial_owner_invitation_one_per_tenant UNIQUE (institution_id)
);
CREATE TABLE pagino.provisioning_operations (
  idempotency_key uuid PRIMARY KEY,
  institution_id uuid NOT NULL UNIQUE REFERENCES pagino.institutions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE pagino.operator_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES pagino.institutions(id),
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pagino.initial_owner_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagino.initial_owner_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE pagino.provisioning_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagino.provisioning_operations FORCE ROW LEVEL SECURITY;
ALTER TABLE pagino.operator_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagino.operator_audit_logs FORCE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA pagino TO provision_operator;
GRANT SELECT, INSERT ON pagino.institutions, pagino.sites, pagino.initial_owner_invitations, pagino.provisioning_operations, pagino.operator_audit_logs TO provision_operator;
GRANT UPDATE (delivery_status) ON pagino.initial_owner_invitations TO provision_operator;
CREATE POLICY provision_operator_institutions_select ON pagino.institutions FOR SELECT TO provision_operator USING (true);
CREATE POLICY provision_operator_institutions_insert ON pagino.institutions FOR INSERT TO provision_operator WITH CHECK (status = 'active');
CREATE POLICY provision_operator_sites_select ON pagino.sites FOR SELECT TO provision_operator USING (true);
CREATE POLICY provision_operator_sites_insert ON pagino.sites FOR INSERT TO provision_operator WITH CHECK (true);
CREATE POLICY provision_operator_invites_select ON pagino.initial_owner_invitations FOR SELECT TO provision_operator USING (true);
CREATE POLICY provision_operator_invites_insert ON pagino.initial_owner_invitations FOR INSERT TO provision_operator WITH CHECK (used_at IS NULL AND delivery_status = 'pending');
CREATE POLICY provision_operator_invites_delivery ON pagino.initial_owner_invitations FOR UPDATE TO provision_operator USING (used_at IS NULL) WITH CHECK (used_at IS NULL);
CREATE POLICY provision_operator_ops_select ON pagino.provisioning_operations FOR SELECT TO provision_operator USING (true);
CREATE POLICY provision_operator_ops_insert ON pagino.provisioning_operations FOR INSERT TO provision_operator WITH CHECK (true);
CREATE POLICY provision_operator_audit_insert ON pagino.operator_audit_logs FOR INSERT TO provision_operator WITH CHECK (action = 'institution.provisioned');
-- Separate invitation acceptance and owner-membership permissions require a dedicated
-- narrow role and transaction in a follow-up implementation; no broad grants are issued here.

-- The only elevation path: token possession + verified Better Auth identity with
-- matching e-mail. The function executes with the migration owner, not app_runtime.
-- The application must also authenticate the session before invoking this function.
CREATE OR REPLACE FUNCTION pagino.accept_initial_owner_invitation(p_user_id text, p_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_invitation pagino.initial_owner_invitations%ROWTYPE;
  v_email text;
  v_verified boolean;
  v_status text;
BEGIN
  IF p_user_id IS NULL OR p_token_hash IS NULL OR length(p_token_hash) <> 64 OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE = '22023';
  END IF;
  SELECT lower(email), email_verified INTO v_email, v_verified
  FROM pagino_auth."user" WHERE id = p_user_id;
  IF NOT FOUND OR NOT v_verified THEN
    RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_invitation FROM pagino.initial_owner_invitations
  WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR v_invitation.used_at IS NOT NULL
     OR v_invitation.expires_at <= now()
     OR v_invitation.delivery_status <> 'sent'
     OR v_invitation.recipient_email <> v_email THEN
    RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO v_status FROM pagino.institutions
  WHERE id = v_invitation.institution_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE = '22023';
  END IF;
  INSERT INTO pagino.memberships (institution_id, user_id, role, status)
  VALUES (v_invitation.institution_id, p_user_id, 'owner', 'active')
  ON CONFLICT (institution_id, user_id) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_INVITATION' USING ERRCODE = '22023';
  END IF;
  UPDATE pagino.initial_owner_invitations
  SET used_at = now(), encrypted_token = ''
  WHERE id = v_invitation.id AND used_at IS NULL;
  INSERT INTO pagino.audit_logs (institution_id, actor_user_id, action, entity_id)
  VALUES (v_invitation.institution_id, p_user_id, 'institution.owner_accepted', v_invitation.institution_id);
  RETURN v_invitation.institution_id;
END;
$$;
REVOKE ALL ON FUNCTION pagino.accept_initial_owner_invitation(text,text) FROM PUBLIC;
-- SECURITY: a SECURITY DEFINER function must not accept a spoofable user id from app_runtime.
-- Keep EXECUTE unavailable until the identity is database-bound.
REVOKE ALL ON FUNCTION pagino.accept_initial_owner_invitation(text,text) FROM app_runtime, auth_runtime, public_reader, provision_operator;

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

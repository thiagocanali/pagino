-- Dedicated-project roles. Execute only in an explicitly authorized database.
CREATE ROLE app_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE auth_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE public_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
REVOKE ALL ON SCHEMA pagino, pagino_auth FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA pagino, pagino_auth FROM PUBLIC;
GRANT USAGE ON SCHEMA pagino TO app_runtime;
GRANT USAGE ON SCHEMA pagino_auth TO auth_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pagino_auth TO auth_runtime;
GRANT SELECT ON pagino.institutions, pagino.memberships TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON pagino.sites, pagino.pages TO app_runtime;
GRANT SELECT, INSERT ON pagino.audit_logs TO app_runtime;
ALTER TABLE pagino.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagino.institutions FORCE ROW LEVEL SECURITY;
ALTER TABLE pagino.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagino.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE pagino.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagino.sites FORCE ROW LEVEL SECURITY;
ALTER TABLE pagino.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagino.pages FORCE ROW LEVEL SECURITY;
ALTER TABLE pagino.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagino.audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_self_read ON pagino.memberships FOR SELECT TO app_runtime
USING (user_id = nullif(current_setting('pagino.user_id', true), '') AND status = 'active');
CREATE POLICY institution_member_read ON pagino.institutions FOR SELECT TO app_runtime
USING (id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND status = 'active' AND EXISTS (
 SELECT 1 FROM pagino.memberships m WHERE m.institution_id = institutions.id AND m.user_id = nullif(current_setting('pagino.user_id', true), '') AND m.status = 'active'
));
CREATE POLICY sites_read ON pagino.sites FOR SELECT TO app_runtime USING (institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND EXISTS (SELECT 1 FROM pagino.institutions i WHERE i.id = sites.institution_id AND i.status = 'active'));
CREATE POLICY sites_insert ON pagino.sites FOR INSERT TO app_runtime WITH CHECK (institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND EXISTS (SELECT 1 FROM pagino.institutions i WHERE i.id = sites.institution_id AND i.status = 'active') AND EXISTS (SELECT 1 FROM pagino.memberships m WHERE m.institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND m.user_id = nullif(current_setting('pagino.user_id', true), '') AND m.status = 'active' AND m.role IN ('owner','admin','editor')));
CREATE POLICY sites_update ON pagino.sites FOR UPDATE TO app_runtime USING (institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND EXISTS (SELECT 1 FROM pagino.institutions i WHERE i.id = sites.institution_id AND i.status = 'active') AND EXISTS (SELECT 1 FROM pagino.memberships m WHERE m.institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND m.user_id = nullif(current_setting('pagino.user_id', true), '') AND m.status = 'active' AND m.role IN ('owner','admin','editor'))) WITH CHECK (institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND EXISTS (SELECT 1 FROM pagino.institutions i WHERE i.id = sites.institution_id AND i.status = 'active') AND EXISTS (SELECT 1 FROM pagino.memberships m WHERE m.institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND m.user_id = nullif(current_setting('pagino.user_id', true), '') AND m.status = 'active' AND m.role IN ('owner','admin','editor')));
CREATE POLICY sites_delete ON pagino.sites FOR DELETE TO app_runtime USING (institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND EXISTS (SELECT 1 FROM pagino.institutions i WHERE i.id = sites.institution_id AND i.status = 'active') AND EXISTS (SELECT 1 FROM pagino.memberships m WHERE m.institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND m.user_id = nullif(current_setting('pagino.user_id', true), '') AND m.status = 'active' AND m.role IN ('owner','admin','editor')));
CREATE POLICY pages_read ON pagino.pages FOR SELECT TO app_runtime USING (institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND EXISTS (SELECT 1 FROM pagino.institutions i WHERE i.id = pages.institution_id AND i.status = 'active'));
CREATE POLICY pages_insert ON pagino.pages FOR INSERT TO app_runtime WITH CHECK (institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND EXISTS (SELECT 1 FROM pagino.institutions i WHERE i.id = pages.institution_id AND i.status = 'active') AND EXISTS (SELECT 1 FROM pagino.memberships m WHERE m.institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND m.user_id = nullif(current_setting('pagino.user_id', true), '') AND m.status = 'active' AND m.role IN ('owner','admin','editor')));
CREATE POLICY pages_update ON pagino.pages FOR UPDATE TO app_runtime USING (institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND EXISTS (SELECT 1 FROM pagino.institutions i WHERE i.id = pages.institution_id AND i.status = 'active') AND EXISTS (SELECT 1 FROM pagino.memberships m WHERE m.institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND m.user_id = nullif(current_setting('pagino.user_id', true), '') AND m.status = 'active' AND m.role IN ('owner','admin','editor'))) WITH CHECK (institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND EXISTS (SELECT 1 FROM pagino.institutions i WHERE i.id = pages.institution_id AND i.status = 'active') AND EXISTS (SELECT 1 FROM pagino.memberships m WHERE m.institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND m.user_id = nullif(current_setting('pagino.user_id', true), '') AND m.status = 'active' AND m.role IN ('owner','admin','editor')));
CREATE POLICY pages_delete ON pagino.pages FOR DELETE TO app_runtime USING (institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND EXISTS (SELECT 1 FROM pagino.institutions i WHERE i.id = pages.institution_id AND i.status = 'active') AND EXISTS (SELECT 1 FROM pagino.memberships m WHERE m.institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND m.user_id = nullif(current_setting('pagino.user_id', true), '') AND m.status = 'active' AND m.role IN ('owner','admin','editor')));
CREATE POLICY audit_insert ON pagino.audit_logs FOR INSERT TO app_runtime
WITH CHECK (institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND EXISTS (SELECT 1 FROM pagino.institutions i WHERE i.id = audit_logs.institution_id AND i.status = 'active') AND EXISTS (SELECT 1 FROM pagino.memberships m WHERE m.institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND m.user_id = nullif(current_setting('pagino.user_id', true), '') AND m.status = 'active' AND m.role IN ('owner','admin','editor')) AND actor_user_id = nullif(current_setting('pagino.user_id', true), ''));
CREATE POLICY audit_read ON pagino.audit_logs FOR SELECT TO app_runtime
USING (institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND EXISTS (SELECT 1 FROM pagino.institutions i WHERE i.id = audit_logs.institution_id AND i.status = 'active') AND EXISTS (SELECT 1 FROM pagino.memberships m WHERE m.institution_id = nullif(current_setting('pagino.institution_id', true), '')::uuid AND m.user_id = nullif(current_setting('pagino.user_id', true), '') AND m.role IN ('owner','admin')));

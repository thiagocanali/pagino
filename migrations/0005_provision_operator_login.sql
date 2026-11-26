-- Dedicated login for the offline provisioning worker.
-- No password is assigned here; configure it out-of-band in Neon before enabling the worker.
CREATE ROLE provision_operator_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT provision_operator TO provision_operator_login;

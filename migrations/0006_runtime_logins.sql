-- Runtime logins are isolated from their NOLOGIN privilege roles.
-- Passwords must be provisioned out-of-band and never stored in migrations.
CREATE ROLE app_runtime_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT app_runtime TO app_runtime_login;
CREATE ROLE auth_runtime_login LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT auth_runtime TO auth_runtime_login;

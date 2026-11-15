/** Validate both the active role and the underlying login identity. */
type Role = {
  name: string
  rolsuper: boolean
  rolbypassrls: boolean
  rolcreaterole: boolean
  rolcreatedb: boolean
  rolcanlogin?: boolean
}

export function assertRestrictedOperator(active: Role | undefined, login: Role | undefined): void {
  if (!active || active.name !== 'provision_operator' || active.rolcanlogin !== false ||
    active.rolsuper || active.rolbypassrls || active.rolcreaterole || active.rolcreatedb) {
    throw new Error('Dedicated restricted operator role required')
  }
  if (!login || login.rolsuper || login.rolbypassrls || login.rolcreaterole || login.rolcreatedb) {
    throw new Error('Privileged operator login forbidden')
  }
}

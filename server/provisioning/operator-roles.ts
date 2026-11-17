/** Validate both the active role and the underlying login identity. */
export type Role = {
  name: string
  rolsuper: boolean
  rolbypassrls: boolean
  rolcreaterole: boolean
  rolcreatedb: boolean
  rolcanlogin: boolean
  rolinherit: boolean
}

/** PostgreSQL drivers expose rows as generic objects; reject missing or mistyped privilege flags. */
export function parseRole(value: unknown): Role | undefined {
  if (!value || typeof value !== 'object') return undefined
  const row = value as Record<string, unknown>
  const booleanFields = ['rolsuper', 'rolbypassrls', 'rolcreaterole', 'rolcreatedb', 'rolcanlogin', 'rolinherit'] as const
  if (typeof row.name !== 'string' || booleanFields.some(field => typeof row[field] !== 'boolean')) return undefined
  return {
    name: row.name,
    rolsuper: row.rolsuper as boolean,
    rolbypassrls: row.rolbypassrls as boolean,
    rolcreaterole: row.rolcreaterole as boolean,
    rolcreatedb: row.rolcreatedb as boolean,
    rolcanlogin: row.rolcanlogin as boolean,
    rolinherit: row.rolinherit as boolean,
  }
}

export function assertRestrictedOperator(active: Role | undefined, login: Role | undefined): void {
  if (!active || active.name !== 'provision_operator' || active.rolcanlogin ||
    active.rolsuper || active.rolbypassrls || active.rolcreaterole || active.rolcreatedb) {
    throw new Error('Dedicated restricted operator role required')
  }
  if (!login || login.name !== 'provision_operator_login' || !login.rolcanlogin || login.rolinherit || login.rolsuper || login.rolbypassrls || login.rolcreaterole || login.rolcreatedb) {
    throw new Error('Privileged operator login forbidden')
  }
}

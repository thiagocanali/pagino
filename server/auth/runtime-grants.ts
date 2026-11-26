/**
 * A NOINHERIT login can still SET ROLE into unexpected grants.
 * The runtime must be a member of exactly one restricted role.
 */
export function assertExclusiveRuntimeGrant(grants: unknown, expected: 'auth_runtime' | 'app_runtime'): void {
  if (!Array.isArray(grants) || grants.length !== 1) throw new Error('Unexpected runtime login role grants')
  const grant: unknown = grants[0]
  if (!grant || typeof grant !== 'object') throw new Error('Unexpected runtime login role grants')
  const row = grant as Record<string, unknown>
  if (row.name !== expected || row.inherits !== false || row.can_set !== true) {
    throw new Error('Unexpected runtime login role grants')
  }
}

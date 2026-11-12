export const roles = ['owner', 'admin', 'editor', 'viewer'] as const
export type Role = typeof roles[number]
export type Permission = 'content.read' | 'content.write' | 'site.publish' | 'audit.read' | 'institution.update' | 'membership.manage_limited' | 'membership.manage_admin' | 'membership.transfer_owner'

const read: Permission[] = ['content.read']
const edit: Permission[] = [...read, 'content.write']
const admin: Permission[] = [...edit, 'site.publish', 'audit.read', 'institution.update', 'membership.manage_limited']
const permissions: Record<Role, readonly Permission[]> = {
  viewer: read,
  editor: edit,
  admin,
  owner: [...admin, 'membership.manage_admin', 'membership.transfer_owner'],
}
export function isRole(value: string): value is Role { return roles.includes(value as Role) }
export function can(role: string, permission: Permission) { return isRole(role) && permissions[role].includes(permission) }

/**
 * Permission Control Module
 * Handles role-based access control (RBAC) for the CRM
 * Roles: 'admin' | 'comercial'
 */

export type UserRole = 'admin' | 'comercial'

export interface CRMUser {
  id: string
  email?: string
  role: UserRole
  full_name?: string
}

/** Check if a user has admin privileges */
export function isAdmin(user: CRMUser | null): boolean {
  if (!user) return false
  return user.role === 'admin'
}

/** Check if a user can delete records — only admins */
export function canDelete(user: CRMUser | null): boolean {
  return isAdmin(user)
}

/** Check if a user can edit all records — only admins */
export function canEditAll(user: CRMUser | null): boolean {
  return isAdmin(user)
}

/** Check if a user can view all records — only admins */
export function canViewAll(user: CRMUser | null): boolean {
  return isAdmin(user)
}

/** Check if a user can manage commissions — only admins */
export function canManageCommissions(user: CRMUser | null): boolean {
  return isAdmin(user)
}

/** Check if a user can view full reports — only admins */
export function canViewFullReports(user: CRMUser | null): boolean {
  return isAdmin(user)
}

/** Check if a user can manage other users — only admins */
export function canManageUsers(user: CRMUser | null): boolean {
  return isAdmin(user)
}

/** Get the role label in Portuguese */
export function getRoleLabel(role: UserRole | string): string {
  const labels: Record<string, string> = {
    admin: 'Administrador',
    comercial: 'Comercial',
  }
  return labels[role] || role
}

/**
 * Permission Control Module
 * Handles role-based access control (RBAC) for the CRM
 * Roles: 'admin' | 'super_admin' | 'comercial'
 */

export type UserRole = 'admin' | 'super_admin' | 'comercial'

export interface CRMUser {
  id: string
  email?: string
  role: UserRole
  full_name?: string
  display_name?: string
}

/**
 * Check if a user has admin privileges (admin or super_admin)
 */
export function isAdmin(user: CRMUser | null): boolean {
  if (!user) return false
  return user.role === 'admin' || user.role === 'super_admin'
}

/**
 * Check if a user can delete records
 * Only admins can delete
 */
export function canDelete(user: CRMUser | null): boolean {
  return isAdmin(user)
}

/**
 * Check if a user can edit all records (not just their own)
 * Only admins can edit all
 */
export function canEditAll(user: CRMUser | null): boolean {
  return isAdmin(user)
}

/**
 * Check if a user can view all records (not just their own)
 * Only admins can view all
 */
export function canViewAll(user: CRMUser | null): boolean {
  return isAdmin(user)
}

/**
 * Check if a user can manage commission statuses
 * Only admins can approve/pay commissions
 */
export function canManageCommissions(user: CRMUser | null): boolean {
  return isAdmin(user)
}

/**
 * Check if a user can access the reports page with full data
 * Comercial users see only their own data in reports
 */
export function canViewFullReports(user: CRMUser | null): boolean {
  return isAdmin(user)
}

/**
 * Check if a user can manage other users
 * Only admins
 */
export function canManageUsers(user: CRMUser | null): boolean {
  return isAdmin(user)
}

/**
 * Get the role label in Portuguese
 */
export function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Administrador',
    super_admin: 'Super Administrador',
    comercial: 'Comercial',
  }
  return labels[role] || role
}

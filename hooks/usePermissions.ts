'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  CRMUser,
  UserRole,
  isAdmin,
  canDelete,
  canEditAll,
  canViewAll,
  canManageCommissions,
  canViewFullReports,
  canManageUsers,
} from '@/lib/permissions'

export interface UsePermissionsReturn {
  user: CRMUser | null
  loading: boolean
  isAdmin: boolean
  canDelete: boolean
  canEditAll: boolean
  canViewAll: boolean
  canManageCommissions: boolean
  canViewFullReports: boolean
  canManageUsers: boolean
  userId: string | null
  role: UserRole | null
}

/**
 * Hook that returns the current user's permissions
 * Fetches the user's role from Supabase and computes permissions
 */
export function usePermissions(): UsePermissionsReturn {
  const [user, setUser] = useState<CRMUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserRole = useCallback(async () => {
    try {
      // Get authenticated user from Supabase Auth
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !authUser) {
        setUser(null)
        setLoading(false)
        return
      }

      // Fetch user role from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role, full_name, display_name')
        .eq('id', authUser.id)
        .single()

      if (userError || !userData) {
        // If user not found in users table, default to 'comercial'
        setUser({
          id: authUser.id,
          email: authUser.email,
          role: 'comercial',
        })
      } else {
        setUser({
          id: userData.id,
          email: authUser.email,
          role: (userData.role as UserRole) || 'comercial',
          full_name: userData.full_name,
          display_name: userData.display_name,
        })
      }
    } catch (error) {
      console.error('Error fetching user permissions:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUserRole()

    // Listen for auth state changes
    const {
      data: { subscription },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user) {
        fetchUserRole()
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchUserRole])

  return {
    user,
    loading,
    isAdmin: isAdmin(user),
    canDelete: canDelete(user),
    canEditAll: canEditAll(user),
    canViewAll: canViewAll(user),
    canManageCommissions: canManageCommissions(user),
    canViewFullReports: canViewFullReports(user),
    canManageUsers: canManageUsers(user),
    userId: user?.id || null,
    role: user?.role || null,
  }
}

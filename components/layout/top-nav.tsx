'use client'

import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePermissions } from '@/hooks/usePermissions'
import { getRoleLabel } from '@/lib/permissions'

export function TopNav() {
  const router = useRouter()
  const { user, role } = usePermissions()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const displayName = user?.full_name || user?.email || ''

  return (
    <header className="h-14 border-b flex items-center justify-end px-6 gap-3">
      {displayName && (
        <span className="text-sm text-muted-foreground">{displayName}</span>
      )}
      {role && (
        <Badge variant="secondary" className="text-xs">
          {getRoleLabel(role)}
        </Badge>
      )}
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-1" />
        Sair
      </Button>
    </header>
  )
}

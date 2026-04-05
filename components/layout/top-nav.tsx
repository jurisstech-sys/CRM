'use client'

import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePermissions } from '@/hooks/usePermissions'
import { getRoleLabel } from '@/lib/permissions'

export function TopNav() {
  const { role, user } = usePermissions()

  return (
    <div className="flex items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-sm text-muted-foreground">
            {user.display_name || user.full_name || user.email}
          </span>
        )}
        {role && (
          <Badge variant="outline" className="text-xs">
            {getRoleLabel(role)}
          </Badge>
        )}
      </div>
      <Link href="/login">
        <Button variant="ghost" size="sm" className="gap-2">
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </Link>
    </div>
  )
}

'use client'

import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function TopNav() {
  return (
    <header className="border-b border-border bg-background/95 sticky top-0 z-40">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex-1" />
        <div className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}

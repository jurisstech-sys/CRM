'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Home, Kanban, Upload, DollarSign, BarChart3, Clock, UserCog, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'

export function Sidebar() {
  const pathname = usePathname()
  const { isAdmin } = usePermissions()

  const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home, adminOnly: false },
    { href: '/clients', label: 'Clientes', icon: Users, adminOnly: false },
    { href: '/pipeline', label: 'Pipeline', icon: Kanban, adminOnly: false },
    { href: '/leads', label: 'Importar Leads', icon: Upload, adminOnly: false },
    { href: '/commissions', label: 'Comissões', icon: DollarSign, adminOnly: false },
    { href: '/commissions/config', label: 'Config. Comissões', icon: Settings, adminOnly: true },
    { href: '/reports', label: 'Relatórios', icon: BarChart3, adminOnly: false },
    { href: '/activities', label: 'Atividades', icon: Clock, adminOnly: false },
    { href: '/users', label: 'Usuários', icon: UserCog, adminOnly: true },
  ]

  return (
    <aside className="w-64 border-r border-border bg-muted/50 h-screen sticky top-0 overflow-y-auto">
      <div className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold text-primary">JurisIA</h1>
        <p className="text-xs text-muted-foreground">CRM System</p>
      </div>
      
      <nav className="p-4 space-y-2">
        {menuItems
          .filter(item => !item.adminOnly || isAdmin)
          .map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
      </nav>
    </aside>
  )
}

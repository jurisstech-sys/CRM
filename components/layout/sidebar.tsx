'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Home, Kanban, Upload, DollarSign, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const pathname = usePathname()

  const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/clients', label: 'Clientes', icon: Users },
    { href: '/pipeline', label: 'Pipeline', icon: Kanban },
    { href: '/leads', label: 'Importar Leads', icon: Upload },
    { href: '/commissions', label: 'Comissões', icon: DollarSign },
    { href: '/reports', label: 'Relatórios', icon: BarChart3 },
  ]

  return (
    <aside className="w-64 border-r border-border bg-muted/50 h-screen sticky top-0 overflow-y-auto">
      <div className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold text-primary">JurisIA</h1>
        <p className="text-xs text-muted-foreground">CRM System</p>
      </div>
      
      <nav className="p-4 space-y-2">
        {menuItems.map((item) => {
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

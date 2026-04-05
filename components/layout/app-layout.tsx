'use client'

import { Sidebar } from './sidebar'
import { TopNav } from './top-nav'

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto py-6 px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

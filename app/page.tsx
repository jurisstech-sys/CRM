'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const [isClient, setIsClient] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    setIsClient(true)

    // Check if user is already logged in - redirect to dashboard
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          router.replace('/dashboard')
          return
        }
      } catch (error) {
        console.error('Session check error:', error)
      } finally {
        setChecking(false)
      }
    }

    checkSession()
  }, [router])

  if (!isClient || checking) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white flex items-center justify-center">
        <div className="animate-pulse text-xl">Carregando...</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">JurisIA CRM</h1>
          <p className="text-xl text-slate-300 mb-8">
            Sistema de Gerenciamento de Relacionamento com Clientes para Escritórios de Advocacia
          </p>
          
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Bem-vindo! 👋</h2>
            <p className="text-slate-300 mb-6">
              Faça login para acessar o painel de controle do JurisIA CRM.
            </p>
            
            <div className="space-y-4">
              <button
                onClick={() => router.push('/login')}
                className="inline-block w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Fazer Login
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
            <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">📊 Gestão de Clientes</h3>
              <p className="text-sm text-slate-400">
                Centralize todas as informações dos seus clientes em um único lugar
              </p>
            </div>
            
            <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">📝 Gerenciamento de Processos</h3>
              <p className="text-sm text-slate-400">
                Acompanhe o progresso de cada processo legal em tempo real
              </p>
            </div>
            
            <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-2">📅 Agenda e Tarefas</h3>
              <p className="text-sm text-slate-400">
                Organize suas atividades e nunca perca um prazo importante
              </p>
            </div>
          </div>

          <div className="mt-12 text-slate-400 text-sm">
            <p>JurisIA CRM © 2024 - Todos os direitos reservados</p>
          </div>
        </div>
      </div>
    </main>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Dashboard() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return null
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-12 flex justify-between items-center">
            <h1 className="text-4xl font-bold">Dashboard</h1>
            <Link
              href="/"
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              ← Voltar
            </Link>
          </div>

          {/* Welcome Section */}
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold mb-4">Bem-vindo ao Dashboard! 📊</h2>
            <p className="text-slate-300 mb-6">
              Este é o painel de controle do JurisIA CRM. Aqui você pode gerenciar clientes, processos e tarefas.
            </p>
            <p className="text-slate-400 text-sm">
              O sistema está em desenvolvimento. Mais funcionalidades serão adicionadas em breve.
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6">
              <h3 className="text-sm text-slate-400 uppercase tracking-wider mb-2">Total de Clientes</h3>
              <p className="text-3xl font-bold">0</p>
              <p className="text-xs text-slate-500 mt-2">Nenhum cliente cadastrado</p>
            </div>
            
            <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6">
              <h3 className="text-sm text-slate-400 uppercase tracking-wider mb-2">Processos Ativos</h3>
              <p className="text-3xl font-bold">0</p>
              <p className="text-xs text-slate-500 mt-2">Nenhum processo em andamento</p>
            </div>
            
            <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-6">
              <h3 className="text-sm text-slate-400 uppercase tracking-wider mb-2">Tarefas Pendentes</h3>
              <p className="text-3xl font-bold">0</p>
              <p className="text-xs text-slate-500 mt-2">Nenhuma tarefa pendente</p>
            </div>
          </div>

          {/* Features Coming Soon */}
          <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-8">
            <h3 className="text-xl font-semibold mb-6">Funcionalidades em Desenvolvimento 🚀</h3>
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Gestão completa de clientes
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Acompanhamento de processos legais
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Sistema de tarefas e agenda
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Relatórios e análises
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                Integração com Supabase
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}

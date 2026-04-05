'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Preencha email e senha.')
      return
    }

    setIsLoading(true)

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
          setError('Email ou senha incorretos.')
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Confirme seu email antes de fazer login.')
        } else {
          setError(authError.message)
        }
        return
      }

      if (data?.session) {
        router.push('/dashboard')
      } else {
        setError('Erro ao criar sessão. Tente novamente.')
      }
    } catch {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-2">JurisIA CRM</h1>
          <p className="text-slate-400">Sistema de Gerenciamento para Escritórios</p>
        </div>

        <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-8">
          <h2 className="text-2xl font-semibold mb-6 text-center">Fazer Login</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-slate-400"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">Senha</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors mt-4"
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Não tem uma conta?{' '}
            <Link href="/" className="text-blue-400 hover:text-blue-300">
              Volte para a página inicial
            </Link>
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          JurisIA CRM © 2024 — Todos os direitos reservados
        </p>
      </div>
    </main>
  )
}

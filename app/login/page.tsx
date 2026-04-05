'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const [isClient, setIsClient] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setIsClient(true)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setError('Por favor, preencha todos os campos')
      return
    }
    
    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Por favor, insira um email válido')
      return
    }
    
    setError('')
    setIsLoading(true)

    try {
      // Tenta fazer login com Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      })

      if (authError) {
        // Mensagens de erro mais amigáveis
        if (authError.message.includes('Invalid login credentials')) {
          setError('Email ou senha incorretos')
        } else if (authError.message.includes('Email not confirmed')) {
          setError('Por favor, confirme seu email antes de fazer login')
        } else {
          setError(authError.message || 'Erro ao fazer login. Tente novamente.')
        }
        return
      }

      if (data?.session) {
        // Login bem-sucedido, redireciona para dashboard
        console.log('✅ Login realizado com sucesso:', data.user?.email)
        router.push('/dashboard')
      } else {
        setError('Erro ao criar sessão. Tente novamente.')
      }
    } catch (err) {
      console.error('❌ Erro durante login:', err)
      setError('Erro inesperado. Por favor, tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isClient) {
    return null
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        {/* Logo/Branding */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">JurisIA CRM</h1>
          <p className="text-slate-400">Sistema de Gerenciamento para Escritórios</p>
        </div>

        {/* Login Form */}
        <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-8">
          <h2 className="text-2xl font-semibold mb-6 text-center">Fazer Login</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-slate-400"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                Senha
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white placeholder-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors mt-6"
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            <p>
              Não tem uma conta?{' '}
              <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
                Volte para a página inicial
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-slate-500">
          <p>JurisIA CRM © 2024 - Todos os direitos reservados</p>
        </div>
      </div>
    </main>
  )
}

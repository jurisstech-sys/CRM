'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="bg-slate-700/50 border border-red-600/30 rounded-lg p-8">
          <h1 className="text-4xl font-bold mb-4">Oops! ❌</h1>
          <h2 className="text-2xl font-semibold text-red-400 mb-4">Algo deu errado</h2>
          
          <div className="bg-red-950/30 border border-red-600/30 rounded p-4 mb-6">
            <p className="text-sm text-slate-300 font-mono break-words">
              {error.message || 'Um erro inesperado ocorreu'}
            </p>
            {error.digest && (
              <p className="text-xs text-slate-500 mt-2">
                ID: {error.digest}
              </p>
            )}
          </div>

          <p className="text-slate-400 mb-6">
            Desculpe, encontramos um problema ao processar sua requisição. Por favor, tente novamente.
          </p>

          <div className="space-y-3">
            <button
              onClick={reset}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Tentar Novamente
            </button>
            
            <a
              href="/"
              className="w-full block px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors text-center"
            >
              Voltar para Início
            </a>
          </div>

          <div className="mt-8 text-xs text-slate-500">
            <p>Se o problema persistir, entre em contato com o suporte.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

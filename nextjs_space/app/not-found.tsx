import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-8 text-center">
          <h1 className="text-6xl font-bold mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-slate-300 mb-4">Página Não Encontrada</h2>
          
          <p className="text-slate-400 mb-8">
            Desculpe, a página que você está procurando não existe ou foi movida.
          </p>

          <div className="space-y-3">
            <Link
              href="/"
              className="inline-block w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Voltar para Início
            </Link>
            
            <Link
              href="/dashboard"
              className="inline-block w-full px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
            >
              Acessar Dashboard
            </Link>
          </div>

          <div className="mt-8">
            <p className="text-sm text-slate-500">
              Se você acha que isso é um erro, entre em contato com o suporte.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

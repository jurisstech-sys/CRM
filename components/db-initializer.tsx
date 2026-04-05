'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function DbInitializer() {
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    let isMounted = true

    const checkAndInitializeDb = async () => {
      try {
        // Check if database is already initialized
        const checkResponse = await fetch('/api/setup', {
          method: 'GET',
        })

        const checkData = await checkResponse.json()

        if (!isMounted) return

        if (checkData.initialized) {
          // Database is already initialized
          setInitialized(true)
          return
        }

        // Database needs to be initialized
        setIsInitializing(true)
        toast.loading('Initializing database...', {
          id: 'db-init',
        })

        const initResponse = await fetch('/api/setup', {
          method: 'POST',
        })

        const initData = await initResponse.json()

        if (!isMounted) return

        if (initResponse.ok && initData.success) {
          setInitialized(true)
          toast.success('Database initialized successfully!', {
            id: 'db-init',
          })
        } else {
          const errorMsg = initData.error || 'Failed to initialize database'
          setError(errorMsg)
          toast.error(errorMsg, {
            id: 'db-init',
          })
        }
      } catch (err) {
        if (!isMounted) return
        
        const errorMsg = err instanceof Error ? err.message : 'Failed to check database status'
        setError(errorMsg)
        console.error('Database initialization error:', err)
        // Don't show toast here as it might be a network error on first load
      } finally {
        if (isMounted) {
          setIsInitializing(false)
        }
      }
    }

    checkAndInitializeDb()

    return () => {
      isMounted = false
    }
  }, [])

  // Only show error UI if there's an error and we couldn't initialize
  if (error && !initialized) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md">
          <h2 className="text-lg font-semibold text-red-600 mb-2">Database Initialization Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">
            Please make sure your Supabase credentials are properly configured in the .env.local file.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Show initializing state
  if (isInitializing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-700 font-medium">Initializing Database...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a moment</p>
          </div>
        </div>
      </div>
    )
  }

  // Database is initialized or we're not showing errors, render nothing
  return null
}

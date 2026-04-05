'use client'

import React, { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Card } from '@/components/ui/card'
import { CommissionTable, Commission } from '@/components/commissions/CommissionTable'
import {
  getUserCommissionsByMonth,
  updateCommissionStatus,
  getMonthlyCommissionSummary,
} from '@/lib/commissions'
import { supabase } from '@/lib/supabase'
import { DollarSign, Clock, CheckCircle2, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { pt } from 'date-fns/locale'

interface User {
  id: string
  full_name: string
}

interface Lead {
  id: string
  title: string
}

interface CommissionWithDetails extends Commission {
  lead_title?: string
  user_name?: string
}

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<CommissionWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState<string>('')
  const [summary, setSummary] = useState({
    totalCommissions: 0,
    pendingCommissions: 0,
    approvedCommissions: 0,
    paidCommissions: 0,
    averageCommission: 0,
  })
  const [users, setUsers] = useState<Map<string, string>>(new Map())
  const [leads, setLeads] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    // Set current month
    const now = new Date()
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    setCurrentMonth(monthStr)

    // Fetch initial data
    fetchData(monthStr)
  }, [])

  const fetchData = async (month: string) => {
    try {
      setLoading(true)

      // Fetch commissions for current month
      const commissionsData = await getUserCommissionsByMonth('current_user', month)

      // Fetch all users for name mapping
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name')

      const userMap = new Map()
      usersData?.forEach((user: User) => {
        userMap.set(user.id, user.full_name)
      })
      setUsers(userMap)

      // Fetch all leads for title mapping
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, title')

      const leadMap = new Map()
      leadsData?.forEach((lead: Lead) => {
        leadMap.set(lead.id, lead.title)
      })
      setLeads(leadMap)

      // Enrich commission data with user and lead info
      const enrichedCommissions: CommissionWithDetails[] = commissionsData
        .filter((comm): comm is Commission => comm.id !== undefined)
        .map((comm) => ({
          ...comm,
          user_name: userMap.get(comm.user_id),
          lead_title: leadMap.get(comm.lead_id),
        }))

      setCommissions(enrichedCommissions)

      // Fetch summary
      const summaryData = await getMonthlyCommissionSummary()
      setSummary(summaryData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Erro ao carregar comissões')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (commissionId: string, newStatus: string) => {
    try {
      const result = await updateCommissionStatus(
        commissionId,
        newStatus as 'pending' | 'approved' | 'paid' | 'cancelled',
        new Date().toISOString().split('T')[0]
      )

      if (result) {
        // Update local state
        setCommissions((prev) =>
          prev.map((comm) =>
            comm.id === commissionId
              ? { ...comm, status: result.status, payment_date: result.payment_date }
              : comm
          )
        )
        toast.success('Status da comissão atualizado')

        // Refresh summary
        const updatedSummary = await getMonthlyCommissionSummary()
        setSummary(updatedSummary)
      }
    } catch (error) {
      console.error('Error updating commission status:', error)
      toast.error('Erro ao atualizar status')
    }
  }

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const [year, month] = currentMonth.split('-').map(Number)
    let newMonth = month
    let newYear = year

    if (direction === 'prev') {
      newMonth -= 1
      if (newMonth < 1) {
        newMonth = 12
        newYear -= 1
      }
    } else {
      newMonth += 1
      if (newMonth > 12) {
        newMonth = 1
        newYear += 1
      }
    }

    const newMonthStr = `${newYear}-${String(newMonth).padStart(2, '0')}`
    setCurrentMonth(newMonthStr)
    fetchData(newMonthStr)
  }

  const formattedMonth = currentMonth
    ? format(new Date(currentMonth + '-01'), 'MMMM yyyy', { locale: pt })
    : ''

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Comissões</h1>
            <p className="text-slate-400 mt-1">Gerenciar comissões do mês</p>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => handleMonthChange('prev')}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm"
          >
            ← Anterior
          </button>
          <span className="text-white font-semibold capitalize min-w-40 text-center">
            {formattedMonth}
          </span>
          <button
            onClick={() => handleMonthChange('next')}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm"
          >
            Próximo →
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Total Commissions */}
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Total de Comissões</p>
                <p className="text-white text-2xl font-bold mt-2">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(summary.totalCommissions)}
                </p>
              </div>
              <div className="bg-green-500/20 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </Card>

          {/* Pending Commissions */}
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Pendentes</p>
                <p className="text-white text-2xl font-bold mt-2">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(summary.pendingCommissions)}
                </p>
              </div>
              <div className="bg-yellow-500/20 p-3 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </Card>

          {/* Approved Commissions */}
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Aprovadas</p>
                <p className="text-white text-2xl font-bold mt-2">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(
                    summary.totalCommissions -
                      summary.pendingCommissions -
                      summary.paidCommissions
                  )}
                </p>
              </div>
              <div className="bg-blue-500/20 p-3 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </Card>

          {/* Paid Commissions */}
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Pagas</p>
                <p className="text-white text-2xl font-bold mt-2">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(summary.paidCommissions)}
                </p>
              </div>
              <div className="bg-emerald-500/20 p-3 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </Card>

          {/* Average Commission */}
          <Card className="bg-slate-800 border-slate-700 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Média</p>
                <p className="text-white text-2xl font-bold mt-2">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(summary.averageCommission)}
                </p>
              </div>
              <div className="bg-purple-500/20 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Commissions Table */}
        <Card className="bg-slate-800 border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Detalhes das Comissões</h2>
          <CommissionTable
            commissions={commissions}
            isLoading={loading}
            onStatusChange={handleStatusChange}
          />
        </Card>
      </div>
    </AppLayout>
  )
}

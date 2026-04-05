/**
 * Commission Calculation Module
 * Handles automatic commission calculation based on lead status transitions
 */

import { supabase } from './supabase'
import { logActivity } from './activities'

export interface CommissionData {
  id?: string
  lead_id: string
  user_id: string
  amount: number
  percentage: number
  currency: string
  status: 'pending' | 'approved' | 'paid' | 'cancelled'
  calculation_method: 'fixed' | 'percentage' | 'tiered'
  payment_date?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

/**
 * Commission rates by pipeline stage (percentage of deal value)
 * These can be overridden by individual user commission_rate
 */
const STAGE_COMMISSION_RATES: Record<string, number> = {
  new: 0,
  contacted: 0,
  qualified: 5,
  proposal: 10,
  negotiation: 15,
  won: 20,
  lost: 0,
}

/**
 * Calculate commission based on deal value and pipeline stage
 * @param dealValue - The monetary value of the deal
 * @param stage - The current pipeline stage
 * @param userCommissionRate - The user's commission rate percentage (optional override)
 * @returns The calculated commission amount
 */
export function calculateCommission(
  dealValue: number,
  stage: string,
  userCommissionRate?: number
): number {
  if (!dealValue || dealValue <= 0) return 0
  
  // Use user's commission rate if provided, otherwise use stage-based rate
  const rate = userCommissionRate ?? (STAGE_COMMISSION_RATES[stage] ?? 0)
  return (dealValue * rate) / 100
}

/**
 * Create a commission record when a lead is moved to "won" status
 * @param leadId - The ID of the lead
 * @param userId - The ID of the user who owns the lead
 * @param dealValue - The value of the deal
 * @param stage - The current pipeline stage
 */
export async function createCommissionOnWin(
  leadId: string,
  userId: string,
  dealValue: number,
  stage: string
): Promise<CommissionData | null> {
  try {
    // Only create commission if moving to 'won' stage
    if (stage !== 'won') {
      return null
    }

    // Fetch user's commission rate
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('commission_rate')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('Error fetching user commission rate:', userError)
      return null
    }

    const userCommissionRate = userData?.commission_rate ?? 0
    const commissionAmount = calculateCommission(dealValue, stage, userCommissionRate)

    // Create commission record
    const { data: commissionData, error: commissionError } = await supabase
      .from('commissions')
      .insert({
        lead_id: leadId,
        user_id: userId,
        amount: commissionAmount,
        percentage: userCommissionRate,
        currency: 'BRL',
        status: 'pending',
        calculation_method: 'percentage',
        notes: `Commission for lead ${leadId} - ${(userCommissionRate * 100).toFixed(1)}% of R$ ${dealValue.toFixed(2)}`,
      })
      .select()
      .single()

    if (commissionError) {
      console.error('Error creating commission:', commissionError)
      return null
    }

    // Update user's monthly commission total
    await updateUserMonthlyCommission(userId)

    // Log the activity
    if (commissionData) {
      await logActivity(
        'create',
        'commission',
        commissionData.id || leadId,
        `Comissão de R$ ${commissionAmount.toFixed(2)} foi criada para o lead ${leadId}`,
        `Comissão ${(userCommissionRate * 100).toFixed(1)}%`
      )
    }

    return commissionData || null
  } catch (error) {
    console.error('Error in createCommissionOnWin:', error)
    return null
  }
}

/**
 * Update user's monthly commission total
 * @param userId - The ID of the user
 */
export async function updateUserMonthlyCommission(userId: string): Promise<void> {
  try {
    // Calculate total commissions for current month
    const currentMonth = new Date()
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    
    const { data: commissionData, error: fetchError } = await supabase
      .from('commissions')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .gte('created_at', monthStart.toISOString())

    if (fetchError) {
      console.error('Error fetching commissions:', fetchError)
      return
    }

    const totalCommission = commissionData?.reduce((sum: number, comm: any) => sum + (comm.amount || 0), 0) || 0

    // Update user's monthly total
    const { error: updateError } = await supabase
      .from('users')
      .update({ monthly_commission_total: totalCommission })
      .eq('id', userId)

    if (updateError) {
      console.error('Error updating user monthly commission:', updateError)
    }
  } catch (error) {
    console.error('Error in updateUserMonthlyCommission:', error)
  }
}

/**
 * Get user's commission history for a given month
 * @param userId - The ID of the user
 * @param month - The month (YYYY-MM format)
 */
export async function getUserCommissionsByMonth(
  userId: string,
  month: string
): Promise<CommissionData[]> {
  try {
    const [year, monthNum] = month.split('-').map(Number)
    const monthStart = new Date(year, monthNum - 1, 1)
    const monthEnd = new Date(year, monthNum, 0)

    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user commissions:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getUserCommissionsByMonth:', error)
    return []
  }
}

/**
 * Get all commissions for a given month
 * @param month - The month (YYYY-MM format)
 */
export async function getAllCommissionsByMonth(month: string): Promise<CommissionData[]> {
  try {
    const [year, monthNum] = month.split('-').map(Number)
    const monthStart = new Date(year, monthNum - 1, 1)
    const monthEnd = new Date(year, monthNum, 0)

    const { data, error } = await supabase
      .from('commissions')
      .select('*')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching commissions:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getAllCommissionsByMonth:', error)
    return []
  }
}

/**
 * Update commission status (e.g., mark as paid)
 * @param commissionId - The ID of the commission
 * @param status - The new status
 * @param paymentDate - The payment date (optional)
 */
export async function updateCommissionStatus(
  commissionId: string,
  status: 'pending' | 'approved' | 'paid' | 'cancelled',
  paymentDate?: string
): Promise<CommissionData | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { status }
    if (paymentDate) {
      updateData.payment_date = paymentDate
    }

    const { data, error } = await supabase
      .from('commissions')
      .update(updateData)
      .eq('id', commissionId)
      .select()
      .single()

    if (error) {
      console.error('Error updating commission status:', error)
      return null
    }

    return data || null
  } catch (error) {
    console.error('Error in updateCommissionStatus:', error)
    return null
  }
}

/**
 * Get commission summary for the current month
 */
export async function getMonthlyCommissionSummary(): Promise<{
  totalCommissions: number
  pendingCommissions: number
  approvedCommissions: number
  paidCommissions: number
  averageCommission: number
}> {
  try {
    const currentMonth = new Date()
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)

    const { data, error } = await supabase
      .from('commissions')
      .select('amount, status')
      .gte('created_at', monthStart.toISOString())

    if (error) {
      console.error('Error fetching commission summary:', error)
      return {
        totalCommissions: 0,
        pendingCommissions: 0,
        approvedCommissions: 0,
        paidCommissions: 0,
        averageCommission: 0,
      }
    }

    const commissions = data || []
    const total = commissions.reduce((sum: number, comm: any) => sum + (comm.amount || 0), 0)
    const pending = commissions
      .filter((c: any) => c.status === 'pending')
      .reduce((sum: number, comm: any) => sum + (comm.amount || 0), 0)
    const approved = commissions
      .filter((c: any) => c.status === 'approved')
      .reduce((sum: number, comm: any) => sum + (comm.amount || 0), 0)
    const paid = commissions
      .filter((c: any) => c.status === 'paid')
      .reduce((sum: number, comm: any) => sum + (comm.amount || 0), 0)

    return {
      totalCommissions: total,
      pendingCommissions: pending,
      approvedCommissions: approved,
      paidCommissions: paid,
      averageCommission: commissions.length > 0 ? total / commissions.length : 0,
    }
  } catch (error) {
    console.error('Error in getMonthlyCommissionSummary:', error)
    return {
      totalCommissions: 0,
      pendingCommissions: 0,
      approvedCommissions: 0,
      paidCommissions: 0,
      averageCommission: 0,
    }
  }
}

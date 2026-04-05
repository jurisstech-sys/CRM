import { supabase } from './supabase'

export type ActionType = 'create' | 'update' | 'delete' | 'move'
export type EntityType = 'client' | 'lead' | 'commission' | 'file'

export interface ActivityLog {
  id?: string
  user_id?: string
  action_type: ActionType
  entity_type: EntityType
  entity_id: string
  entity_name?: string
  description: string
  old_value?: string
  new_value?: string
  created_at?: string
}

/**
 * Log an activity to the activity_logs table
 * This function records all CRUD operations and movements in the system
 * 
 * @param actionType - Type of action: 'create', 'update', 'delete', 'move'
 * @param entityType - Type of entity: 'client', 'lead', 'commission', 'file'
 * @param entityId - UUID of the entity
 * @param description - Human-readable description of the action
 * @param entityName - Optional name of the entity (for display in timeline)
 * @param oldValue - Optional previous value (for updates)
 * @param newValue - Optional new value (for updates)
 */
export async function logActivity(
  actionType: ActionType,
  entityType: EntityType,
  entityId: string,
  description: string,
  entityName?: string,
  oldValue?: string,
  newValue?: string
): Promise<void> {
  try {
    // Get the current user ID from Supabase auth
    const { data: { user } } = await supabase.auth.getUser()
    
    const activityLog: ActivityLog = {
      user_id: user?.id,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      description,
      old_value: oldValue,
      new_value: newValue,
    }

    const { error } = await supabase
      .from('activity_logs')
      .insert([activityLog])

    if (error) {
      console.error('Error logging activity:', error)
      // Don't throw, as this shouldn't block the main operation
    }
  } catch (error) {
    console.error('Error in logActivity:', error)
    // Silent fail - logging errors shouldn't break the main application flow
  }
}

/**
 * Fetch activity logs with filters
 */
export async function fetchActivityLogs(
  filters?: {
    entityType?: EntityType
    actionType?: ActionType
    userId?: string
    limit?: number
    offset?: number
  }
): Promise<ActivityLog[]> {
  try {
    let query = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.entityType) {
      query = query.eq('entity_type', filters.entityType)
    }

    if (filters?.actionType) {
      query = query.eq('action_type', filters.actionType)
    }

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, (filters.offset + (filters.limit || 10)) - 1)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching activity logs:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in fetchActivityLogs:', error)
    return []
  }
}

/**
 * Get activity logs for a specific entity
 */
export async function getEntityActivityLogs(
  entityId: string,
  entityType: EntityType
): Promise<ActivityLog[]> {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('entity_id', entityId)
      .eq('entity_type', entityType)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching entity activity logs:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getEntityActivityLogs:', error)
    return []
  }
}

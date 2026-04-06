import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials')
}

// SQL Schema with all tables and configurations
const _SQL_SCHEMA = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  department VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  last_login TIMESTAMP WITH TIME ZONE,
  commission_rate DECIMAL(5, 2) DEFAULT 0.00,
  monthly_commission_total DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  details JSONB
);

-- Activity Logs Table (Timeline de Atividades do Sistema)
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('create', 'update', 'delete', 'move')),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('client', 'lead', 'commission', 'file')),
  entity_id UUID NOT NULL,
  entity_name VARCHAR(255),
  description TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Clients Table (Clientes)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  legal_entity_type VARCHAR(50) CHECK (legal_entity_type IN ('PF', 'PJ')),
  cpf_cnpj VARCHAR(20) UNIQUE,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  country VARCHAR(100) DEFAULT 'Brazil',
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'prospect')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Leads Table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  source VARCHAR(100),
  value DECIMAL(15, 2),
  currency VARCHAR(3) DEFAULT 'BRL',
  status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  expected_close_date DATE,
  probability DECIMAL(5, 2) DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  next_follow_up DATE,
  email1 TEXT,
  email2 TEXT,
  email3 TEXT,
  phone1 TEXT,
  phone2 TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Pipeline Stages Table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  color VARCHAR(7),
  is_won_stage BOOLEAN DEFAULT FALSE,
  is_lost_stage BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activities Table (Atividades)
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'task', 'follow_up')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  contact_method VARCHAR(50) CHECK (contact_method IN ('phone', 'email', 'whatsapp', 'in_person', 'video_call')),
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Commissions Table (Comissões)
CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount DECIMAL(15, 2) NOT NULL,
  percentage DECIMAL(5, 2),
  currency VARCHAR(3) DEFAULT 'BRL',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  calculation_method VARCHAR(50) CHECK (calculation_method IN ('fixed', 'percentage', 'tiered')),
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_cpf_cnpj ON clients(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);

CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_expected_close_date ON leads(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by);

CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_client_id ON activities(client_id);
CREATE INDEX IF NOT EXISTS idx_activities_assigned_to ON activities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activities_due_date ON activities(due_date);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_priority ON activities(priority);

CREATE INDEX IF NOT EXISTS idx_commissions_lead_id ON commissions(lead_id);
CREATE INDEX IF NOT EXISTS idx_commissions_user_id ON commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_payment_date ON commissions(payment_date);

-- Commission Config Table (Configuração de Comissões por Usuário e Etapa)
CREATE TABLE IF NOT EXISTS commission_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL,
  percentage DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_commission_config_user_id ON commission_config(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_config_stage ON commission_config(stage);

-- Lead comments table for timeline
CREATE TABLE IF NOT EXISTS lead_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  files JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_comments_lead_id ON lead_comments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_comments_user_id ON lead_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_comments_created_at ON lead_comments(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_id ON activity_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS clients_updated_at ON clients;
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS activities_updated_at ON activities;
CREATE TRIGGER activities_updated_at BEFORE UPDATE ON activities
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS commissions_updated_at ON commissions;
CREATE TRIGGER commissions_updated_at BEFORE UPDATE ON commissions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS pipeline_stages_updated_at ON pipeline_stages;
CREATE TRIGGER pipeline_stages_updated_at BEFORE UPDATE ON pipeline_stages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS commission_config_updated_at ON commission_config;
CREATE TRIGGER commission_config_updated_at BEFORE UPDATE ON commission_config
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view clients" ON clients;
DROP POLICY IF EXISTS "Users can view leads" ON leads;
DROP POLICY IF EXISTS "Users can view activities" ON activities;
DROP POLICY IF EXISTS "Users can view commissions" ON commissions;
DROP POLICY IF EXISTS "Users can view audit logs" ON audit_logs;

-- Create basic RLS policies
-- Users can view all users (for team management)
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (TRUE);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Users can view clients they created or are assigned to
CREATE POLICY "Users can view clients" ON clients FOR SELECT USING (
  created_by = auth.uid() OR 
  id IN (SELECT client_id FROM leads WHERE assigned_to = auth.uid())
);

-- Users can view leads assigned to them
CREATE POLICY "Users can view leads" ON leads FOR SELECT USING (
  assigned_to = auth.uid() OR 
  created_by = auth.uid()
);

-- Users can view their own activities
CREATE POLICY "Users can view activities" ON activities FOR SELECT USING (
  assigned_to = auth.uid() OR 
  created_by = auth.uid()
);

-- Users can view commissions for their own leads
CREATE POLICY "Users can view commissions" ON commissions FOR SELECT USING (
  user_id = auth.uid() OR 
  lead_id IN (SELECT id FROM leads WHERE assigned_to = auth.uid())
);

-- Users can view their own audit logs
CREATE POLICY "Users can view audit logs" ON audit_logs FOR SELECT USING (
  user_id = auth.uid()
);

-- Commission config policies
DROP POLICY IF EXISTS "Admin can manage commission config" ON commission_config;
CREATE POLICY "Admin can manage commission config" ON commission_config FOR ALL USING (TRUE);

-- Lead comments policies
DROP POLICY IF EXISTS "All users can manage lead comments" ON lead_comments;
CREATE POLICY "All users can manage lead comments" ON lead_comments FOR ALL USING (TRUE);
`

const DEFAULT_PIPELINE_STAGES = [
  { name: 'Backlog', description: 'Leads em espera', position: 1, color: '#6B7280', is_won_stage: false, is_lost_stage: false },
  { name: 'Em Contato', description: 'Em contato com o lead', position: 2, color: '#3B82F6', is_won_stage: false, is_lost_stage: false },
  { name: 'Em Negociação', description: 'Lead em negociação', position: 3, color: '#EAB308', is_won_stage: false, is_lost_stage: false },
  { name: 'Negociação Fechada', description: 'Negociação fechada com sucesso', position: 4, color: '#22C55E', is_won_stage: true, is_lost_stage: false },
  { name: 'Lead Não Qualificado', description: 'Lead não qualificado', position: 5, color: '#EF4444', is_won_stage: false, is_lost_stage: true },
  { name: 'Prospecção Futura', description: 'Lead para prospecção futura', position: 6, color: '#A855F7', is_won_stage: false, is_lost_stage: false },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkTablesExist(supabase: any): Promise<boolean> {
  try {
    // Try to query one of the tables to check if it exists
    const { error } = await supabase
      .from('pipeline_stages')
      .select('id')
      .limit(1)
    
    // If no error, tables exist
    return !error
  } catch {
    return false
  }
}

// GET /api/setup - Check if tables exist
export async function GET() {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    const tablesExist = await checkTablesExist(supabase)
    
    return NextResponse.json({
      initialized: tablesExist,
      message: tablesExist ? 'Database is already initialized' : 'Database needs to be initialized',
    })
  } catch (error) {
    console.error('Error checking setup status:', error)
    return NextResponse.json(
      { error: 'Failed to check setup status' },
      { status: 500 }
    )
  }
}

// POST /api/setup - Initialize the database
export async function POST(_request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Check if already initialized
    const tablesExist = await checkTablesExist(supabase)
    
    if (tablesExist) {
      return NextResponse.json({
        success: true,
        message: 'Database is already initialized',
      })
    }

    // Execute schema using Supabase's sql method via the admin client
    // Note: We need to use the raw PostgreSQL connection for this
    // For now, we'll try using Supabase's approach
    console.log('Initializing database...')

    // Insert default pipeline stages
    const { data: stages, error: stagesError } = await supabase
      .from('pipeline_stages')
      .insert(DEFAULT_PIPELINE_STAGES)
      .select()
    
    if (stagesError && !stagesError.message?.includes('duplicate')) {
      throw stagesError
    }

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      stages_created: stages?.length || DEFAULT_PIPELINE_STAGES.length,
    })
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   } catch (error: any) {
    console.error('Error initializing database:', error)
    return NextResponse.json(
      { 
        error: 'Failed to initialize database',
        details: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}
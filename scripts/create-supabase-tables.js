#!/usr/bin/env node

const { Client } = require('pg');

// Connection string
const connectionString = 'postgresql://postgres.krmbhkmgifiwvzhcvivj:JurisCrm@12@aws-1-us-east-2.pooler.supabase.com:6543/postgres';

// Default pipeline stages data
const DEFAULT_PIPELINE_STAGES = [
  { name: 'New', description: 'New lead', position: 1, color: '#3B82F6', is_won_stage: false, is_lost_stage: false },
  { name: 'Contacted', description: 'Lead contacted', position: 2, color: '#8B5CF6', is_won_stage: false, is_lost_stage: false },
  { name: 'Qualified', description: 'Lead qualified', position: 3, color: '#EC4899', is_won_stage: false, is_lost_stage: false },
  { name: 'Proposal', description: 'Proposal sent', position: 4, color: '#F59E0B', is_won_stage: false, is_lost_stage: false },
  { name: 'Negotiation', description: 'In negotiation', position: 5, color: '#EF4444', is_won_stage: false, is_lost_stage: false },
  { name: 'Won', description: 'Deal won', position: 6, color: '#10B981', is_won_stage: true, is_lost_stage: false },
  { name: 'Lost', description: 'Deal lost', position: 7, color: '#6B7280', is_won_stage: false, is_lost_stage: true },
];

// Complete SQL schema
const SQL_SCHEMA = `
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

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

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can view clients" ON clients;
DROP POLICY IF EXISTS "Users can view leads" ON leads;
DROP POLICY IF EXISTS "Users can view activities" ON activities;
DROP POLICY IF EXISTS "Users can view commissions" ON commissions;
DROP POLICY IF EXISTS "Users can view audit logs" ON audit_logs;

-- Create basic RLS policies
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (TRUE);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view clients" ON clients FOR SELECT USING (
  created_by = auth.uid() OR 
  id IN (SELECT client_id FROM leads WHERE assigned_to = auth.uid())
);
CREATE POLICY "Users can view leads" ON leads FOR SELECT USING (
  assigned_to = auth.uid() OR 
  created_by = auth.uid()
);
CREATE POLICY "Users can view activities" ON activities FOR SELECT USING (
  assigned_to = auth.uid() OR 
  created_by = auth.uid()
);
CREATE POLICY "Users can view commissions" ON commissions FOR SELECT USING (
  user_id = auth.uid() OR 
  lead_id IN (SELECT id FROM leads WHERE assigned_to = auth.uid())
);
CREATE POLICY "Users can view audit logs" ON audit_logs FOR SELECT USING (
  user_id = auth.uid()
);
`;

async function executeSqlSchema(client) {
  console.log('📝 Executing SQL schema...');
  
  try {
    // Execute the full schema as a single transaction
    // This preserves PL/pgSQL functions with dollar quotes
    await client.query(SQL_SCHEMA);
    console.log('✅ SQL schema executed successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to execute SQL schema:', error.message);
    throw error;
  }
}

async function insertDefaultPipelineStages(client) {
  console.log('📝 Inserting default pipeline stages...');
  
  try {
    // Check if pipeline stages already exist
    const checkResult = await client.query('SELECT COUNT(*) FROM pipeline_stages');
    const count = parseInt(checkResult.rows[0].count);
    
    if (count > 0) {
      console.log(`✅ Pipeline stages already exist (${count} records found)`);
      return true;
    }

    // Insert default stages
    for (const stage of DEFAULT_PIPELINE_STAGES) {
      const query = `
        INSERT INTO pipeline_stages (name, description, position, color, is_won_stage, is_lost_stage)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (name) DO NOTHING
      `;
      
      await client.query(query, [
        stage.name,
        stage.description,
        stage.position,
        stage.color,
        stage.is_won_stage,
        stage.is_lost_stage
      ]);
    }
    
    console.log(`✅ Inserted ${DEFAULT_PIPELINE_STAGES.length} default pipeline stages`);
    return true;
  } catch (error) {
    console.error('❌ Failed to insert pipeline stages:', error.message);
    throw error;
  }
}

async function verifyTables(client) {
  console.log('\n🔍 Verifying tables...');
  
  const tables = [
    'users',
    'clients',
    'leads',
    'activities',
    'commissions',
    'pipeline_stages',
    'audit_logs'
  ];

  try {
    for (const table of tables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [table]);
      
      const exists = result.rows[0].exists;
      console.log(`${exists ? '✅' : '❌'} Table '${table}': ${exists ? 'EXISTS' : 'NOT FOUND'}`);
      
      if (!exists) {
        throw new Error(`Table '${table}' was not created`);
      }
    }
    
    // Verify pipeline stages data
    const stagesResult = await client.query('SELECT COUNT(*) FROM pipeline_stages');
    const stageCount = parseInt(stagesResult.rows[0].count);
    console.log(`✅ Pipeline stages: ${stageCount} records found`);
    
    return true;
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  }
}

async function main() {
  const client = new Client({
    connectionString: connectionString
  });

  try {
    console.log('🚀 Starting Supabase CRM database setup...\n');
    console.log('📍 Connecting to database...');
    
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Execute schema
    await executeSqlSchema(client);

    // Insert default data
    await insertDefaultPipelineStages(client);

    // Verify everything
    await verifyTables(client);

    console.log('\n🎉 SUCCESS! All tables created and data inserted successfully!');
    console.log('✨ Your JurisIA CRM database is ready to use.\n');

  } catch (error) {
    console.error('\n❌ SETUP FAILED:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the script
main();

# JurisIA CRM - SQL Schema

This document contains the complete SQL schema for the JurisIA CRM system. Execute these SQL commands in your Supabase SQL Editor to create all necessary tables and configurations.

## Instructions for Supabase Setup

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to the **SQL Editor** section
3. Click on **New Query**
4. Copy and paste the SQL schema below
5. Click **Execute** or press `Ctrl+Enter`
6. Verify all tables are created successfully

---

## Complete SQL Schema

```sql
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
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_cpf_cnpj ON clients(cpf_cnpj);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_created_by ON clients(created_by);

CREATE INDEX idx_leads_client_id ON leads(client_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_expected_close_date ON leads(expected_close_date);
CREATE INDEX idx_leads_created_by ON leads(created_by);

CREATE INDEX idx_activities_lead_id ON activities(lead_id);
CREATE INDEX idx_activities_client_id ON activities(client_id);
CREATE INDEX idx_activities_assigned_to ON activities(assigned_to);
CREATE INDEX idx_activities_due_date ON activities(due_date);
CREATE INDEX idx_activities_status ON activities(status);
CREATE INDEX idx_activities_priority ON activities(priority);

CREATE INDEX idx_commissions_lead_id ON commissions(lead_id);
CREATE INDEX idx_commissions_user_id ON commissions(user_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_payment_date ON commissions(payment_date);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER activities_updated_at BEFORE UPDATE ON activities
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER commissions_updated_at BEFORE UPDATE ON commissions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
```

## Post-Setup Steps

After executing the SQL schema:

1. **Verify Table Creation**
   - Go to the Supabase Dashboard → Database → Tables
   - Confirm all 7 tables are created: users, clients, leads, activities, commissions, pipeline_stages, audit_logs

2. **Create Initial Admin User**
   - You may need to create an initial admin user via your application
   - Or manually insert a user record via the SQL Editor

3. **Configure Authentication**
   - Set up Auth providers in Supabase (Email/Password, Google, etc.)
   - Configure redirect URLs in Supabase Auth settings

4. **Install Dependencies**
   ```bash
   npm install @supabase/supabase-js
   ```

5. **Test Connection**
   - Use the `lib/supabase.ts` to connect to your database
   - Run your application locally to verify the connection

## Security Notes

- ✅ Row Level Security (RLS) is enabled on all tables
- ✅ Policies restrict data access based on user roles
- ✅ Audit logs track all important changes
- ✅ Environment variables protect sensitive credentials
- ⚠️ Customize RLS policies based on your specific business logic
- ⚠️ Regularly review and update security policies

## Troubleshooting

**Error: Extension already exists**
- This is normal. The `IF NOT EXISTS` clause prevents duplicate creation.

**Connection refused**
- Verify your DATABASE_URL and credentials in `.env.local`
- Check that Supabase project is running

**RLS policy errors**
- Ensure you're logged in with a valid Supabase user
- Check that auth.uid() returns a valid UUID

## Next Steps

1. Run this schema in your Supabase SQL Editor
2. Update your `.env.local` with the credentials provided
3. Test the connection from your Next.js application
4. Start building your CRM features with the database backend

/**
 * Migration: Sistema de Permissões, Planos e Comissões
 *
 * Cria/atualiza as tabelas necessárias para:
 *  - Cadastro de Planos (plans) + seed dos 5 planos padrão
 *  - Configuração de Comissões (commission_config)
 *  - Auditoria de atividades (activity_logs)
 *  - Vínculo Plano <-> Lead (leads.plan_id, leads.custom_value)
 *  - Gestão de usuários: soft delete + comissões (users.deleted_at, commission_rate, monthly_commission_total)
 *  - Ajuste do CHECK constraint de role para aceitar 'comercial'
 *
 * Uso: node scripts/migrate-plans-commissions.js
 */

const { Client } = require('pg')

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres.krmbhkmgifiwvzhcvivj:JurisCrm@12@aws-1-us-east-2.pooler.supabase.com:6543/postgres'

const SQL = `
-- Extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TABELA DE PLANOS
-- ============================================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  price DECIMAL(15, 2),                 -- NULL = valor personalizado (Enterprise)
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  currency VARCHAR(3) DEFAULT 'BRL',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(active);

-- ============================================================
-- 2. CONFIGURAÇÃO DE COMISSÕES (por usuário e etapa)
-- ============================================================
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

-- ============================================================
-- 3. AUDITORIA / TIMELINE DE ATIVIDADES
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('create', 'update', 'delete', 'move')),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('client', 'lead', 'commission', 'file')),
  entity_id VARCHAR(255) NOT NULL,
  entity_name VARCHAR(255),
  description TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- ============================================================
-- 4. VÍNCULO PLANO <-> LEAD
-- ============================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_value DECIMAL(15, 2);
CREATE INDEX IF NOT EXISTS idx_leads_plan_id ON leads(plan_id);

-- ============================================================
-- 5. GESTÃO DE USUÁRIOS: soft delete + comissões
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5, 2) DEFAULT 0.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_commission_total DECIMAL(15, 2) DEFAULT 0.00;

-- Ajuste do CHECK de role para aceitar 'comercial' e 'super_admin'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'super_admin', 'comercial', 'user', 'viewer'));
`

const SEED_PLANS = [
  { name: 'Starter', price: 49.9, is_custom: false, position: 1, description: 'Plano inicial para quem está começando.' },
  { name: 'Profissional', price: 119.9, is_custom: false, position: 2, description: 'Plano profissional com recursos avançados.' },
  { name: 'Avançado', price: 249.9, is_custom: false, position: 3, description: 'Plano avançado para equipes em crescimento.' },
  { name: 'Escritório', price: 599.9, is_custom: false, position: 4, description: 'Plano completo para escritórios.' },
  { name: 'Enterprise', price: null, is_custom: true, position: 5, description: 'Plano personalizado. Valor definido manualmente por negociação.' },
]

async function main() {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  console.log('🔌 Conectado ao banco de dados')

  try {
    console.log('⚙️  Executando DDL...')
    await client.query(SQL)
    console.log('✅ Estrutura criada/atualizada')

    console.log('🌱 Inserindo planos padrão...')
    for (const p of SEED_PLANS) {
      await client.query(
        `INSERT INTO plans (name, description, price, is_custom, position, active)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         ON CONFLICT (name) DO UPDATE SET
           description = EXCLUDED.description,
           price = EXCLUDED.price,
           is_custom = EXCLUDED.is_custom,
           position = EXCLUDED.position,
           updated_at = CURRENT_TIMESTAMP`,
        [p.name, p.description, p.price, p.is_custom, p.position]
      )
      const label = p.price === null ? 'personalizado' : `R$ ${p.price.toFixed(2)}`
      console.log(`   • ${p.name} (${label})`)
    }

    const { rows } = await client.query('SELECT name, price, is_custom FROM plans ORDER BY position')
    console.log('\n📋 Planos no banco:')
    console.table(rows)

    console.log('\n✅ Migração concluída com sucesso!')
  } catch (err) {
    console.error('❌ Erro na migração:', err.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()

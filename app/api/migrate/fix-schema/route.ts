import { NextResponse } from 'next/server'
import { Pool } from 'pg'

/**
 * Migration endpoint to fix all known schema issues for lead import.
 * Call POST /api/migrate/fix-schema once to fix:
 * 1. Status CHECK constraint on leads table
 * 2. UNIQUE constraint on client_id
 * 3. Create imported_leads table
 * 4. Add email/phone columns if missing
 */
export async function POST() {
  try {
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      return NextResponse.json(
        { success: false, error: 'DATABASE_URL não configurada' },
        { status: 500 }
      )
    }

    const pool = new Pool({ connectionString: databaseUrl })
    const results: string[] = []

    // 1. Fix status CHECK constraint
    try {
      await pool.query(`
        ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
      `)
      results.push('✅ Old status constraint dropped')
      
      await pool.query(`
        ALTER TABLE leads ADD CONSTRAINT leads_status_check 
          CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'backlog', 'em_contato', 'em_negociacao', 'negociacao_fechada', 'lead_nao_qualificado', 'prospeccao_futura'));
      `)
      results.push('✅ New status constraint added')
    } catch (e) {
      results.push(`⚠️ Status constraint: ${e}`)
    }

    // 2. Remove UNIQUE on client_id
    try {
      await pool.query(`
        ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_client_id_key;
      `)
      results.push('✅ client_id UNIQUE constraint removed')
    } catch (e) {
      results.push(`⚠️ client_id constraint: ${e}`)
    }

    // 3. Add missing columns
    try {
      await pool.query(`
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS email1 TEXT;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS email2 TEXT;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS email3 TEXT;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone1 TEXT;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone2 TEXT;
      `)
      results.push('✅ Email/phone columns verified')
    } catch (e) {
      results.push(`⚠️ Add columns: ${e}`)
    }

    // 4. Create imported_leads table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS imported_leads (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          nome TEXT NOT NULL,
          celular1 TEXT,
          celular2 TEXT,
          email1 TEXT,
          email2 TEXT,
          email3 TEXT,
          status TEXT DEFAULT 'backlog',
          arquivo_origem TEXT,
          imported_by UUID,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `)
      results.push('✅ imported_leads table created/verified')
    } catch (e) {
      results.push(`⚠️ imported_leads: ${e}`)
    }

    // 5. Create exec_sql function for future use
    try {
      await pool.query(`
        CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
        RETURNS void AS $$
        BEGIN
          EXECUTE sql_query;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `)
      results.push('✅ exec_sql function created')
    } catch (e) {
      results.push(`⚠️ exec_sql function: ${e}`)
    }

    // Verify current state
    const statusResult = await pool.query(`
      SELECT constraint_name, check_clause 
      FROM information_schema.check_constraints 
      WHERE constraint_name = 'leads_status_check';
    `)

    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'leads' 
      AND column_name IN ('email1', 'email2', 'email3', 'phone1', 'phone2')
      ORDER BY column_name;
    `)

    const importedTableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'imported_leads'
      );
    `)

    await pool.end()

    return NextResponse.json({
      success: true,
      message: 'Schema migration completed',
      results,
      verification: {
        statusConstraint: statusResult.rows,
        leadColumns: columnsResult.rows,
        importedLeadsExists: importedTableResult.rows[0]?.exists,
      }
    })

  } catch (error) {
    console.error('Schema fix error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST /api/migrate/fix-schema para corrigir o schema do banco de dados',
    fixes: [
      'Status CHECK constraint (permite backlog, em_contato, etc.)',
      'Remove UNIQUE on client_id',
      'Cria tabela imported_leads',
      'Adiciona colunas email1-3, phone1-2',
      'Cria função exec_sql',
    ]
  })
}

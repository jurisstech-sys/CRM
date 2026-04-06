import { NextResponse } from 'next/server'
import { Pool } from 'pg'

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

    const sql = `
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS email1 TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS email2 TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS email3 TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone1 TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone2 TEXT;
    `

    await pool.query(sql)

    // Verificar
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'leads' 
      AND column_name IN ('email1', 'email2', 'email3', 'phone1', 'phone2')
      ORDER BY column_name;
    `)

    await pool.end()

    return NextResponse.json({
      success: true,
      message: `Migração concluída! ${result.rows.length} colunas verificadas.`,
      columns: result.rows
    })

  } catch (error) {
    console.error('Direct SQL migration error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}

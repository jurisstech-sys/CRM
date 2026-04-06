// Script para adicionar colunas de contato na tabela leads
// Executa via conexão direta PostgreSQL

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Ler .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) envVars[match[1].trim()] = match[2].trim()
})

const DATABASE_URL = envVars.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL não encontrada no .env.local')
  process.exit(1)
}

console.log('🔧 Conectando ao banco de dados...')
console.log('URL:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'))

const sql = `
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS email1 TEXT;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS email2 TEXT;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS email3 TEXT;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone1 TEXT;
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone2 TEXT;
`

async function migrate() {
  const client = new Client({ connectionString: DATABASE_URL })
  
  try {
    await client.connect()
    console.log('✅ Conectado ao banco!')
    
    console.log('\n📦 Executando migração...')
    console.log(sql)
    
    await client.query(sql)
    
    console.log('✅ Colunas adicionadas com sucesso!')
    
    // Verificar
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'leads' 
      AND column_name IN ('email1', 'email2', 'email3', 'phone1', 'phone2')
      ORDER BY column_name;
    `)
    
    console.log('\n📊 Colunas verificadas:')
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name} (${row.data_type})`)
    })
    
    if (result.rows.length === 5) {
      console.log('\n🎉 Todas as 5 colunas estão presentes!')
    } else {
      console.log(`\n⚠️ Apenas ${result.rows.length}/5 colunas encontradas`)
    }
    
  } catch (error) {
    console.error('❌ Erro na migração:', error.message)
  } finally {
    await client.end()
    console.log('\n🔒 Conexão fechada.')
  }
}

migrate()

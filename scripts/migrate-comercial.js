/**
 * Executa a migration `manual_add_comercial_id.sql` no PostgreSQL (Supabase).
 * - Adiciona coluna comercial_id em leads (FK -> users)
 * - Faz backfill a partir de assigned_to
 * - Cria índice idx_leads_comercial_id
 * - Estende a constraint de action_type de activity_logs
 *
 * Uso: node scripts/migrate-comercial.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// parse .env.local manualmente
const env = {};
fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  .split('\n')
  .forEach((l) => {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  });

async function run() {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'prisma', 'migrations', 'manual_add_comercial_id.sql'),
    'utf8'
  );

  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  console.log('🔄 Executando migration comercial_id...');

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration aplicada com sucesso.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Erro na migration (rollback aplicado):', e.message);
    process.exit(1);
  }

  // Verificação de integridade
  const col = await client.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_name = 'leads' AND column_name = 'comercial_id'`
  );
  console.log('\n📋 Coluna comercial_id:', col.rows[0] || 'NÃO ENCONTRADA');

  const idx = await client.query(
    `SELECT indexname FROM pg_indexes WHERE tablename = 'leads' AND indexname = 'idx_leads_comercial_id'`
  );
  console.log('📋 Índice:', idx.rows[0]?.indexname || 'NÃO ENCONTRADO');

  const backfill = await client.query(
    `SELECT count(*) AS total,
            count(comercial_id) AS com_comercial,
            count(assigned_to) AS com_assigned
       FROM leads`
  );
  console.log('📊 Backfill:', backfill.rows[0]);

  const con = await client.query(
    `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint
      WHERE conname = 'activity_logs_action_type_check'`
  );
  console.log('📋 Constraint action_type:', con.rows[0]?.def || 'NÃO ENCONTRADA');

  await client.end();
  console.log('\n✅ Verificação de integridade concluída.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

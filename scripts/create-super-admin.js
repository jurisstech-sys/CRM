const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Ler credenciais do .env.local
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const SUPABASE_URL = envVars['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_ROLE_KEY = envVars['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createSuperAdmin() {
  try {
    console.log('Creating super admin user...');
    console.log('Using Supabase URL:', SUPABASE_URL);
    
    // Tentar buscar usuário existente
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    const existingUser = users.find(u => u.email === 'contato@juriss.com.br');
    
    let userId;
    
    if (existingUser) {
      console.log('ℹ️  User already exists:', existingUser.id);
      userId = existingUser.id;
    } else {
      // Criar usuário no Auth
      const { data: { user }, error: authError } = await supabase.auth.admin.createUser({
        email: 'contato@juriss.com.br',
        password: 'Juris@1711',
        email_confirm: true,
      });

      if (authError) throw authError;
      console.log('✅ User created in Auth:', user.id);
      userId = user.id;
    }

    // Inserir na tabela users
    const { data, error: dbError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: 'contato@juriss.com.br',
        role: 'admin',
        created_at: new Date().toISOString(),
      })
      .select();

    if (dbError) throw dbError;
    console.log('✅ Super admin created successfully:', data);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createSuperAdmin();

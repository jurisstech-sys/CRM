const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Ler credenciais do .env.local
const envPath = path.join(__dirname, '.env.local');
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

console.log('Testing Supabase connection...');
console.log('URL:', SUPABASE_URL);
console.log('Service Role Key length:', SERVICE_ROLE_KEY ? SERVICE_ROLE_KEY.length : 'NOT SET');

// Teste básico
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function test() {
  try {
    const { data, error } = await supabase.from('users').select('count');
    if (error) {
      console.error('Database Error:', error);
    } else {
      console.log('✅ Connection successful');
      console.log('Response:', data);
    }
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

test();

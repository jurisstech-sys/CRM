const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match && !line.startsWith('#')) {
    envVars[match[1]] = match[2];
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || 'https://krmbhkmgifiwvzhcvivj.supabase.co';
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Supabase Diagnostic Test\n');
console.log('=' . repeat(60));
console.log('1️⃣  CONFIGURATION CHECK');
console.log('=' . repeat(60));
console.log(`✓ Supabase URL: ${supabaseUrl}`);
console.log(`✓ Anon Key Present: ${supabaseAnonKey ? 'YES' : 'NO'}`);
console.log(`✓ Service Role Key Present: ${supabaseServiceRoleKey ? 'YES' : 'NO'}`);

async function testConnections() {
  // Test with Anon Key
  console.log('\n' + '='.repeat(60));
  console.log('2️⃣  TEST ANON KEY CONNECTION');
  console.log('='.repeat(60));

  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    const { data, error } = await supabaseAnon.from('users').select('count');
    if (error) {
      console.log(`❌ Failed to query users table`);
      console.log(`   Error: ${error.message}`);
    } else {
      console.log(`✓ Successfully connected with Anon Key`);
      console.log(`  Users in database: ${data ? data.length : 'unknown'}`);
    }
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
  }

  // Test with Service Role Key
  console.log('\n' + '='.repeat(60));
  console.log('3️⃣  TEST SERVICE ROLE KEY CONNECTION');
  console.log('='.repeat(60));

  if (supabaseServiceRoleKey) {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false
      }
    });

    try {
      const { data, error } = await supabaseAdmin.from('users').select('id, email');
      if (error) {
        console.log(`❌ Failed to query users table`);
        console.log(`   Error: ${error.message}`);
      } else {
        console.log(`✓ Successfully connected with Service Role Key`);
        console.log(`  Users found: ${data.length}`);
        if (data.length > 0) {
          console.log(`\n  User List:`);
          data.forEach(user => {
            console.log(`    - ${user.email} (ID: ${user.id})`);
          });
        }
      }
    } catch (err) {
      console.log(`❌ Exception: ${err.message}`);
    }
  } else {
    console.log('⚠️  Service Role Key not available');
  }

  // Test specific user with Anon Key
  console.log('\n' + '='.repeat(60));
  console.log('4️⃣  SEARCH FOR TEST USER (with Anon Key)');
  console.log('='.repeat(60));

  try {
    const { data, error } = await supabaseAnon.from('users').select('*').eq('email', 'contato@juriss.com.br');
    if (error) {
      console.log(`❌ Failed to search user`);
      console.log(`   Error: ${error.message}`);
    } else {
      if (data && data.length > 0) {
        console.log(`✓ User found: contato@juriss.com.br`);
        console.log(`  User Data:`);
        console.log(`    ID: ${data[0].id}`);
        console.log(`    Email: ${data[0].email}`);
        console.log(`    Role: ${data[0].role || 'N/A'}`);
      } else {
        console.log(`❌ User NOT found in users table`);
      }
    }
  } catch (err) {
    console.log(`❌ Exception: ${err.message}`);
  }

  // Test auth user listing with Service Role
  console.log('\n' + '='.repeat(60));
  console.log('5️⃣  LIST AUTH USERS (with Service Role Key)');
  console.log('='.repeat(60));

  if (supabaseServiceRoleKey) {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    try {
      const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) {
        console.log(`❌ Failed to list auth users`);
        console.log(`   Error: ${error.message}`);
      } else {
        console.log(`✓ Auth Users: ${users.users.length}`);
        users.users.forEach(user => {
          console.log(`  - ${user.email} (Created: ${new Date(user.created_at).toLocaleString()})`);
          if (user.email === 'contato@juriss.com.br') {
            console.log(`    → THIS IS OUR TEST USER`);
            console.log(`    → Confirmed in Auth`);
          }
        });
      }
    } catch (err) {
      console.log(`❌ Exception: ${err.message}`);
    }
  } else {
    console.log('⚠️  Service Role Key not available');
  }

  // Check API key validity
  console.log('\n' + '='.repeat(60));
  console.log('6️⃣  API KEY VALIDITY CHECK');
  console.log('='.repeat(60));

  try {
    // Try a simple GET request to check if API key is valid
    const response = await fetch(`${supabaseUrl}/rest/v1/users?select=id&limit=0`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });

    console.log(`HTTP Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      console.log(`✓ API Key is VALID`);
    } else if (response.status === 401) {
      console.log(`❌ API Key is INVALID or EXPIRED`);
    } else {
      console.log(`⚠️  Unexpected status code`);
    }
  } catch (err) {
    console.log(`❌ Request failed: ${err.message}`);
  }
}

testConnections().then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('Diagnostic complete!');
  console.log('='.repeat(60));
});

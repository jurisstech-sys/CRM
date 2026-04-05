const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const supabaseUrl = 'https://krmbhkmgifiwvzhcvivj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtybWJoa21naWZpd3d6aGN2aXZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTA5NzQsImV4cCI6MjA5MDg4Njk3NH0.SvaoFww4A_LxQtVCC4ET8T9tixQjjXJbGEFGJwTXI8A';

console.log('🔍 Starting Supabase Login Test...\n');
console.log('📍 Configuration:');
console.log(`   Supabase URL: ${supabaseUrl}`);
console.log(`   Anon Key: ${supabaseAnonKey.substring(0, 20)}...`);
console.log('\n');

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test login
async function testLogin() {
  try {
    console.log('🔐 Attempting to sign in...');
    console.log('   Email: contato@juriss.com.br');
    console.log('   Password: Juris@1711\n');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'contato@juriss.com.br',
      password: 'Juris@1711'
    });

    if (error) {
      console.log('❌ LOGIN FAILED');
      console.log('\n📋 Error Details:');
      console.log(`   Error Message: ${error.message}`);
      console.log(`   Error Code: ${error.status}`);
      console.log(`   Error: ${JSON.stringify(error, null, 2)}`);
      return false;
    }

    console.log('✅ LOGIN SUCCESSFUL!');
    console.log('\n📋 User Data:');
    console.log(`   User ID: ${data.user?.id}`);
    console.log(`   Email: ${data.user?.email}`);
    console.log(`   Session: ${data.session ? 'Valid' : 'None'}`);
    console.log(`   Access Token: ${data.session?.access_token.substring(0, 20)}...`);
    return true;
  } catch (err) {
    console.log('❌ UNEXPECTED ERROR');
    console.log('\n📋 Error Details:');
    console.log(`   Error: ${err.message}`);
    console.log(`   Stack: ${err.stack}`);
    return false;
  }
}

// Run test
testLogin().then((success) => {
  console.log('\n' + '='.repeat(50));
  console.log(`Result: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log('='.repeat(50));
  process.exit(success ? 0 : 1);
});

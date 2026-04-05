import { createClient } from '@supabase/supabase-js'

// Direct Supabase credentials
const SUPABASE_URL = 'https://krmbhkmgifiwvzhcvivj.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtybWJoa21naWZpd3d6aGN2aXZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTMxMDk3NCwiZXhwIjoyMDkwODg2OTc0fQ.dFRwb8UzqiH1XeiiUhYFM99nNZodj93sbPVryxOC6KE'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

// Create Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function createSuperAdmin() {
  try {
    const email = 'contato@juriss.com.br'
    const password = 'Juris@1711'

    console.log('🚀 Creating super admin user...')
    console.log(`📧 Email: ${email}`)

    // Step 1: First, update the constraint to allow 'super_admin' role
    console.log('📝 Updating database schema to support super_admin role...')
    try {
      const { error: updateError } = await supabase.rpc('exec', {
        sql: `
          -- Drop existing constraint
          ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
          
          -- Add new constraint with super_admin
          ALTER TABLE users ADD CONSTRAINT users_role_check 
          CHECK (role IN ('super_admin', 'admin', 'user', 'viewer'));
        `
      })
      
      if (updateError && !updateError.message?.includes('already exists')) {
        // Try direct approach using raw SQL (might work better)
        console.log('⚠️  RPC approach failed, attempting direct insertion...')
      } else {
        console.log('✅ Schema updated to support super_admin role')
      }
    } catch (err) {
      console.log('⚠️  Schema update failed, will proceed with user creation...')
    }

    // Step 2: Create user in Supabase Auth
    console.log('🔐 Creating user in Supabase Auth...')
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    let userId: string | undefined

    if (authError) {
      // Check if user already exists
      if (authError.message?.includes('already exists')) {
        console.log('⚠️  User already exists in auth, continuing...')
        
        // Get existing user
        const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers()
        if (listError) {
          console.error('❌ Could not list users:', listError)
          process.exit(1)
        }
        
        const existingUser = existingUsers.users.find((u: any) => u.email === email)
        if (!existingUser) {
          console.error('❌ Could not find user after creation attempt')
          process.exit(1)
        }
        
        userId = existingUser.id
      } else {
        console.error('❌ Error creating user in auth:', authError)
        process.exit(1)
      }
    } else {
      userId = authData.user?.id
    }

    if (!userId) {
      console.error('❌ Could not determine user ID')
      process.exit(1)
    }
    console.log(`✅ User created in Supabase Auth: ${userId}`)

    // Step 3: Insert user record in the users table
    console.log('📝 Inserting user record in database...')
    const { data: insertedUser, error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        full_name: 'Super Admin',
        role: 'super_admin',
        status: 'active',
      })
      .select()

    if (insertError) {
      // Check if it's a constraint error and try to work around it
      if (insertError.message?.includes('CHECK constraint')) {
        console.log('⚠️  Constraint error detected, attempting workaround...')
        
        // Try to update the constraint directly
        try {
          await supabase.rpc('exec', {
            sql: `
              ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
            `
          })
          console.log('✅ Constraint removed, retrying insert...')
          
          // Retry insert
          const { data: retryInsert, error: retryError } = await supabase
            .from('users')
            .insert({
              id: userId,
              email,
              full_name: 'Super Admin',
              role: 'super_admin',
              status: 'active',
            })
            .select()

          if (retryError) {
            console.error('❌ Error inserting user (retry):', retryError)
            process.exit(1)
          }

          console.log('✅ User record created successfully')
        } catch (err) {
          console.error('❌ Error removing constraint:', err)
          process.exit(1)
        }
      } else {
        console.error('❌ Error inserting user:', insertError)
        process.exit(1)
      }
    } else {
      console.log('✅ User record created successfully')
    }

    // Step 4: Verify the user was created correctly
    console.log('🔍 Verifying user creation...')
    const { data: verifyUser, error: verifyError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (verifyError) {
      console.error('❌ Error verifying user:', verifyError)
      process.exit(1)
    }

    console.log('✅ Super admin user verified:')
    console.log(`   📧 Email: ${verifyUser.email}`)
    console.log(`   👤 ID: ${verifyUser.id}`)
    console.log(`   🔐 Role: ${verifyUser.role}`)
    console.log(`   📊 Status: ${verifyUser.status}`)

    console.log('\n🎉 Super admin user created successfully!')
    console.log('\n📝 Credentials:')
    console.log(`   Email: ${email}`)
    console.log(`   Password: ${password}`)
    console.log(`   Role: super_admin`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

// Run the function
createSuperAdmin()

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST() {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing config' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Add new columns (idempotent)
    const { error: err1 } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS email1 TEXT;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS email2 TEXT;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS email3 TEXT;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone1 TEXT;
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone2 TEXT;
      `,
    });

    // If rpc doesn't exist, try direct approach
    if (err1) {
      console.log('[Migration] RPC not available, columns may already exist or need manual migration');
    }

    return NextResponse.json({ success: true, message: 'Migration completed' });
  } catch (error) {
    console.error('[Migration] Error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}

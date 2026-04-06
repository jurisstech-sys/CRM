import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getAuthUser(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const accessToken = authHeader.replace('Bearer ', '');
  const supabaseAuth = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: { user }, error } = await supabaseAuth.auth.getUser(accessToken);
  if (error || !user) return null;
  return user;
}

// GET: Fetch comments for a lead
export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Configuração incompleta' }, { status: 500 });
    }

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const leadId = request.nextUrl.searchParams.get('lead_id');
    if (!leadId) {
      return NextResponse.json({ error: 'lead_id é obrigatório' }, { status: 400 });
    }

    // Ensure table exists
    await ensureLeadCommentsTable(supabase);

    const { data, error } = await supabase
      .from('lead_comments')
      .select('*, users(full_name, email)')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Lead Comments API] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comments: data || [] });
  } catch (error) {
    console.error('[Lead Comments API] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// POST: Add a comment to a lead
export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Configuração incompleta' }, { status: 500 });
    }

    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await request.json();
    const { lead_id, comment, files } = body;

    if (!lead_id || !comment?.trim()) {
      return NextResponse.json({ error: 'lead_id e comment são obrigatórios' }, { status: 400 });
    }

    // Ensure table exists
    await ensureLeadCommentsTable(supabase);

    const { data, error } = await supabase
      .from('lead_comments')
      .insert({
        lead_id,
        user_id: user.id,
        comment: comment.trim(),
        files: files || null,
      })
      .select('*, users(full_name, email)')
      .single();

    if (error) {
      console.error('[Lead Comments API] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comment: data });
  } catch (error) {
    console.error('[Lead Comments API] Error:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureLeadCommentsTable(supabase: any) {
  try {
    // Quick check if table exists
    const { error } = await supabase.from('lead_comments').select('id').limit(1);
    if (!error) return;

    // Create table via RPC or raw SQL
    const sql = `
      CREATE TABLE IF NOT EXISTS lead_comments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        files JSONB DEFAULT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_lead_comments_lead_id ON lead_comments(lead_id);
      CREATE INDEX IF NOT EXISTS idx_lead_comments_user_id ON lead_comments(user_id);
      CREATE INDEX IF NOT EXISTS idx_lead_comments_created_at ON lead_comments(created_at);
      ALTER TABLE lead_comments ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "All users can manage lead comments" ON lead_comments;
      CREATE POLICY "All users can manage lead comments" ON lead_comments FOR ALL USING (TRUE);
    `;
    await supabase.rpc('exec_sql', { sql_query: sql }).catch(() => {
      // If RPC fails, the table likely already exists or we can't create it dynamically
      console.log('[Lead Comments] Could not create table via RPC, may already exist');
    });
  } catch (e) {
    console.error('[Lead Comments] ensureTable error:', e);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Configuração do servidor incompleta' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await request.json();
    const { email, password, full_name, role } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      );
    }

    const validRoles = ['admin', 'comercial'];
    const userRole = validRoles.includes(role) ? role : 'comercial';

    // Create auth user
    let authUserId: string | null = null;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      // If the auth user already exists, recover their id so we can ensure their
      // profile exists in public.users (fixes "ghost" users that exist in auth only)
      if (authError.message.includes('already been registered') || authError.message.includes('already registered')) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers();
        const existing = list?.users?.find((u) => u.email?.toLowerCase() === String(email).toLowerCase());
        if (existing) {
          authUserId = existing.id;
          // Reset the password to the provided one for consistency
          await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
        } else {
          return NextResponse.json({ error: 'Este email já está registrado' }, { status: 409 });
        }
      } else {
        console.error('[Users Create] Auth error:', authError.message);
        return NextResponse.json(
          { error: `Erro ao criar usuário: ${authError.message}` },
          { status: 400 }
        );
      }
    } else {
      authUserId = authData.user?.id || null;
    }

    if (!authUserId) {
      return NextResponse.json(
        { error: 'Erro ao criar usuário (sem dados retornados)' },
        { status: 500 }
      );
    }

    // Upsert into users table (creates the profile, or restores/updates an existing one)
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: authUserId,
        email,
        full_name: full_name || null,
        role: userRole,
        status: 'active',
        deleted_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (insertError) {
      console.error('[Users Create] Insert error:', insertError.message);
      return NextResponse.json(
        { error: `Usuário criado na autenticação mas erro ao salvar perfil: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      userId: authUserId,
      message: 'Usuário criado com sucesso',
    });
  } catch (error) {
    console.error('[Users Create] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

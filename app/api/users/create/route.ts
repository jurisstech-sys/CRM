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
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('[Users Create] Auth error:', authError.message);
      if (authError.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'Este email já está registrado' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: `Erro ao criar usuário: ${authError.message}` },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Erro ao criar usuário (sem dados retornados)' },
        { status: 500 }
      );
    }

    // Insert into users table
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name: full_name || null,
        role: userRole,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[Users Create] Insert error:', insertError.message);
      // User was created in auth but failed in users table - still return success
      // but log the error
      return NextResponse.json({
        success: true,
        warning: `Usuário criado na autenticação mas erro ao salvar perfil: ${insertError.message}`,
        userId: authData.user.id,
      });
    }

    return NextResponse.json({
      success: true,
      userId: authData.user.id,
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

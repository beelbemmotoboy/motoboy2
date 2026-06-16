import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
      return json({ error: 'Configuracao da funcao incompleta.' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ error: 'Sessao invalida.' }, 401);
    }

    const { data: currentUser, error: currentUserError } = await adminClient
      .from('obras_users')
      .select('id, account_id, role, active, login_enabled')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();

    if (
      currentUserError
      || !currentUser
      || !currentUser.active
      || !currentUser.login_enabled
      || !['owner', 'admin'].includes(currentUser.role)
    ) {
      return json({ error: 'Voce nao pode gerenciar usuarios do Obras.' }, 403);
    }

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const nome = String(body.nome || '').trim();
    const cidadeId = String(body.cidadeId || '').trim();
    const cidade = String(body.cidade || '').trim();
    const role = String(body.role || 'operador');
    const accountId = String(body.accountId || currentUser.account_id);
    const password = String(body.password || '');
    const cpf = String(body.cpf || '').trim();
    const professionalRegistry = String(body.professionalRegistry || '').trim();

    if (!email || !nome || !cidadeId || !cidade) {
      return json({ error: 'Nome, e-mail e cidade sao obrigatorios.' }, 400);
    }
    if (accountId !== currentUser.account_id) {
      return json({ error: 'A conta informada nao pertence ao administrador atual.' }, 403);
    }
    if (!['owner', 'admin', 'engenheiro', 'arquiteto', 'operador', 'viewer'].includes(role)) {
      return json({ error: 'Perfil de acesso invalido.' }, 400);
    }
    if (['engenheiro', 'arquiteto'].includes(role) && !professionalRegistry) {
      return json({ error: role === 'arquiteto' ? 'Informe o CAU do arquiteto.' : 'Informe o CREA do engenheiro.' }, 400);
    }
    if (password && password.length < 6) {
      return json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, 400);
    }

    let authUser = null;
    for (let page = 1; page <= 10 && !authUser; page += 1) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      authUser = data.users.find((item) => item.email?.toLowerCase() === email) || null;
      if (data.users.length < 1000) break;
    }

    if (!authUser) {
      if (password) {
        const { data, error } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            application: 'beelbem-obras',
            name: nome,
            cpf: cpf || undefined,
            professional_registry: professionalRegistry || undefined,
            role,
          },
        });
        if (error) throw error;
        authUser = data.user;
      } else {
        const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo: body.redirectTo || undefined,
          data: {
            application: 'beelbem-obras',
            name: nome,
            cpf: cpf || undefined,
            professional_registry: professionalRegistry || undefined,
            role,
          },
        });
        if (error) throw error;
        authUser = data.user;
      }
    } else if (password) {
      const { data, error } = await adminClient.auth.admin.updateUserById(authUser.id, {
        password,
        user_metadata: {
          ...(authUser.user_metadata || {}),
          application: 'beelbem-obras',
          name: nome,
          cpf: cpf || undefined,
          professional_registry: professionalRegistry || undefined,
          role,
        },
      });
      if (error) throw error;
      authUser = data.user;
    }

    const payload = {
      auth_user_id: authUser?.id || null,
      account_id: accountId,
      nome,
      email,
      telefone: String(body.telefone || '').trim() || null,
      cpf: cpf || null,
      professional_registry: professionalRegistry || null,
      cidade_id: cidadeId,
      cidade,
      role,
      active: body.active !== false,
      login_enabled: body.loginEnabled !== false,
      invited_by: authData.user.id,
    };

    const { data: existingUser, error: existingError } = await adminClient
      .from('obras_users')
      .select('id')
      .eq('account_id', accountId)
      .ilike('email', email)
      .maybeSingle();
    if (existingError) throw existingError;

    const query = existingUser
      ? adminClient.from('obras_users').update(payload).eq('id', existingUser.id)
      : adminClient.from('obras_users').insert(payload);
    const { data: obrasUser, error: saveError } = await query.select('*').single();
    if (saveError) throw saveError;

    return json({ user: obrasUser });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha ao convidar usuario.' }, 400);
  }
});

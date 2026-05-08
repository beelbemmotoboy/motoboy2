import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

  const { action, profileId, updates } = await request.json();
  if (!action || !profileId) return json({ error: 'action and profileId are required' }, 400);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) return json({ error: 'Invalid session' }, 401);

  const { data: requester, error: requesterError } = await adminClient
    .from('profiles')
    .select('id, role, city_id, active')
    .eq('id', user.id)
    .single();

  if (requesterError || !requester?.active) {
    return json({ error: 'Requester profile not allowed' }, 403);
  }

  const { data: target, error: targetError } = await adminClient
    .from('profiles')
    .select('id, role, city_id, name, email, active')
    .eq('id', profileId)
    .single();

  if (targetError || !target) {
    return json({ error: targetError?.message || 'Profile not found' }, 404);
  }

  const canManage =
    requester.role === 'system_admin' ||
    (
      requester.role === 'city_admin' &&
      target.role !== 'system_admin' &&
      requester.city_id === target.city_id
    );

  if (!canManage) return json({ error: 'You cannot manage this user' }, 403);
  if (target.id === requester.id && action === 'delete') {
    return json({ error: 'You cannot delete your own access' }, 400);
  }

  if (action === 'delete') {
    await adminClient
      .from('profiles')
      .update({ active: false })
      .eq('id', target.id);

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(target.id);
    if (deleteAuthError) {
      return json({
        ok: true,
        mode: 'deactivated',
        warning: `Usuario desativado, mas nao foi possivel excluir do Auth: ${deleteAuthError.message}`,
      });
    }
    return json({ ok: true });
  }

  if (action === 'set_password') {
    const password = String(updates?.password ?? '');
    if (password.length < 6) {
      return json({ error: 'Password must have at least 6 characters' }, 400);
    }

    const { error: updatePasswordError } = await adminClient.auth.admin.updateUserById(target.id, {
      password,
      email_confirm: true,
      user_metadata: { name: target.name, role: target.role },
    });

    if (updatePasswordError) {
      return json({ error: updatePasswordError.message }, 400);
    }

    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        password_set_at: new Date().toISOString(),
        active: true,
      })
      .eq('id', target.id);

    if (profileError) {
      return json({ error: profileError.message }, 400);
    }

    return json({ ok: true, profileId: target.id, email: target.email });
  }

  if (action !== 'update') return json({ error: 'Invalid action' }, 400);

  const nextName = String(updates?.name ?? target.name).trim();
  const nextActive = Boolean(updates?.active);
  const nextCpf = String(updates?.cpf ?? '').trim() || null;
  const nextWhatsapp = String(updates?.whatsapp ?? '').trim() || null;
  const nextAddressProofPath = String(updates?.address_proof_path ?? '').trim() || null;
  if (!nextName) return json({ error: 'Name is required' }, 400);

  const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(target.id, {
    user_metadata: { name: nextName, role: target.role },
  });
  if (updateAuthError) return json({ error: updateAuthError.message }, 400);

  const { data: profile, error: updateProfileError } = await adminClient
    .from('profiles')
    .update({
      name: nextName,
      cpf: nextCpf,
      whatsapp: nextWhatsapp,
      address_proof_path: nextAddressProofPath,
      active: nextActive,
    })
    .eq('id', target.id)
    .select('id, name, email, role, city_id, store_id, courier_id, active')
    .single();

  if (updateProfileError) return json({ error: updateProfileError.message }, 400);

  return json({ ok: true, profile });
});

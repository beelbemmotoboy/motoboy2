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

async function findUserByEmail(supabase: ReturnType<typeof createClient>, email: string) {
  const normalized = email.trim().toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === normalized);
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
  return null;
}

function temporaryPassword() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => String(byte % 10)).join('');
  return `Bee@${suffix}a`;
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing authorization header' }, 401);
  }

  const { inviteId } = await request.json();
  if (!inviteId) {
    return json({ error: 'inviteId is required' }, 400);
  }

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

  if (userError || !user) {
    return json({ error: 'Invalid session' }, 401);
  }

  const { data: requester, error: requesterError } = await adminClient
    .from('profiles')
    .select('role, city_id, active')
    .eq('id', user.id)
    .single();

  if (requesterError || !requester?.active) {
    return json({ error: 'Requester profile not allowed' }, 403);
  }

  const { data: invite, error: inviteError } = await adminClient
    .from('access_invites')
    .select('id, email, name, cpf, whatsapp, address_proof_path, role, city_id, store_id, courier_id, user_active')
    .eq('id', inviteId)
    .single();

  if (inviteError || !invite) {
    return json({ error: inviteError?.message || 'Invite not found' }, 404);
  }

  const canManage =
    requester.role === 'system_admin' ||
    (
      requester.role === 'city_admin' &&
      invite.role !== 'system_admin' &&
      requester.city_id === invite.city_id
    );

  if (!canManage) {
    return json({ error: 'You cannot invite this user' }, 403);
  }

  const email = String(invite.email).trim().toLowerCase();
  let authUser = await findUserByEmail(adminClient, email);
  const password = temporaryPassword();

  if (!authUser) {
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: invite.name, role: invite.role },
    });

    if (createError || !createData.user) {
      return json({ error: createError?.message || 'Could not create Auth user' }, 400);
    }

    authUser = createData.user;
  } else {
    const { data: updateData, error: updateError } = await adminClient.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(authUser.user_metadata || {}), name: invite.name, role: invite.role },
    });

    if (updateError || !updateData.user) {
      return json({ error: updateError?.message || 'Could not update Auth user password' }, 400);
    }

    authUser = updateData.user;
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: authUser.id,
      city_id: invite.city_id,
      store_id: invite.store_id,
      courier_id: invite.courier_id,
      name: invite.name,
      email,
      cpf: invite.cpf,
      whatsapp: invite.whatsapp,
      address_proof_path: invite.address_proof_path,
      role: invite.role,
      active: invite.user_active,
      password_set_at: new Date().toISOString(),
    });

  if (profileError) {
    return json({ error: profileError.message }, 400);
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await adminClient
    .from('access_invites')
    .update({
      status: 'accepted',
      password_setup_sent_at: new Date().toISOString(),
      password_setup_expires_at: expiresAt,
      password_setup_token: 'temporary_password',
      accepted_at: new Date().toISOString(),
      invited_by: user.id,
    })
    .eq('id', invite.id);

  return json({
    ok: true,
    authUserId: authUser.id,
    mode: 'temporary_password',
    temporaryPassword: password,
  });
});

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
  const appUrl = Deno.env.get('APP_URL') || 'https://www.beelbem.com.br';

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
  let linkType: 'invite' | 'password_reset' = 'password_reset';
  let setupLink = '';

  if (!authUser) {
    const { data: linkData, error: authInviteError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { name: invite.name, role: invite.role },
        redirectTo: `${appUrl}/#create-password`,
      },
    });

    if (authInviteError || !linkData.user) {
      return json({ error: authInviteError?.message || 'Could not create invite link' }, 400);
    }

    authUser = linkData.user;
    setupLink = linkData.properties?.action_link ?? '';
    linkType = 'invite';
  } else {
    const { data: linkData, error: recoveryLinkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${appUrl}/#create-password`,
      },
    });

    if (recoveryLinkError) {
      return json({ error: recoveryLinkError.message || 'Could not create password recovery link' }, 400);
    }

    setupLink = linkData.properties?.action_link ?? '';
    linkType = 'password_reset';
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
    });

  if (profileError) {
    return json({ error: profileError.message }, 400);
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  await adminClient
    .from('access_invites')
    .update({
      status: setupLink ? 'sent' : 'accepted',
      password_setup_sent_at: setupLink ? new Date().toISOString() : null,
      password_setup_expires_at: setupLink ? expiresAt : null,
      password_setup_token: setupLink ? 'generated_by_edge_function' : null,
      accepted_at: setupLink ? null : new Date().toISOString(),
      invited_by: user.id,
    })
    .eq('id', invite.id);

  return json({ ok: true, authUserId: authUser.id, linkType, setupLink });
});

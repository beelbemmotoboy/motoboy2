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

  const resetSecret = Deno.env.get('RESET_ADMIN_SECRET');
  if (!resetSecret) {
    return json({ error: 'RESET_ADMIN_SECRET is not configured' }, 500);
  }

  const payload = await request.json();
  if (payload.secret !== resetSecret) {
    return json({ error: 'Invalid reset secret' }, 403);
  }

  const email = String(payload.email || 'beelbemmotoboy@gmail.com').trim().toLowerCase();
  const password = String(payload.password || '');
  const name = String(payload.name || 'Beelbem Motoboy').trim();

  if (!email || !password || password.length < 6) {
    return json({ error: 'Email and password with at least 6 characters are required' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let authUser = await findUserByEmail(adminClient, email);

  if (!authUser) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error || !data.user) {
      return json({ error: error?.message || 'Could not create auth user' }, 400);
    }
    authUser = data.user;
  } else {
    const { data, error } = await adminClient.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(authUser.user_metadata || {}), name },
    });
    if (error || !data.user) {
      return json({ error: error?.message || 'Could not update auth user password' }, 400);
    }
    authUser = data.user;
  }

  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({
      id: authUser.id,
      name,
      email,
      role: 'system_admin',
      active: true,
      city_id: null,
      store_id: null,
      courier_id: null,
      password_set_at: new Date().toISOString(),
    });

  if (profileError) {
    return json({ error: profileError.message }, 400);
  }

  return json({
    ok: true,
    userId: authUser.id,
    email,
    role: 'system_admin',
    active: true,
  });
});

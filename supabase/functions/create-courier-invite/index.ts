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

  const payload = await request.json();
  const courier = payload.courier ?? {};
  const cityId = String(courier.city_id ?? '');
  const email = String(courier.email ?? '').trim().toLowerCase();

  if (!cityId || !email || !courier.name) {
    return json({ error: 'Courier city, name and email are required' }, 400);
  }

  const canManage =
    requester.role === 'system_admin' ||
    (requester.role === 'city_admin' && requester.city_id === cityId);

  if (!canManage) {
    return json({ error: 'You cannot create couriers for this city' }, 403);
  }

  const { data: createdCourier, error: courierError } = await adminClient
    .from('couriers')
    .insert(courier)
    .select('id, city_id, name, birth_date, cpf, phone, email, face_photo_path, whatsapp_validated, vehicle_type, vehicle_plate, pix_key, pix_key_type, pix_holder_name, vehicle_notes, cnh_file_path, cnh_valid_until, internal_notes, approval_status, availability_status, rating, active')
    .single();

  if (courierError) {
    return json({ error: courierError.message }, 400);
  }

  let authUser = await findUserByEmail(adminClient, email);
  const password = temporaryPassword();

  if (!authUser) {
    const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: courier.name, role: 'courier_admin' },
    });

    if (createError || !createData.user) {
      return json({
        ok: true,
        courier: createdCourier,
        mode: 'temporary_password_failed',
        warning: `Entregador cadastrado, mas nao foi possivel criar o usuario no Auth/senha temporaria: ${createError?.message || 'Could not create Auth user'}`,
      });
    }

    authUser = createData.user;
  } else {
    const { data: updateData, error: updateError } = await adminClient.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(authUser.user_metadata || {}), name: courier.name, role: 'courier_admin' },
    });

    if (updateError || !updateData.user) {
      return json({
        ok: true,
        courier: createdCourier,
        mode: 'temporary_password_failed',
        warning: `Entregador cadastrado, mas nao foi possivel definir senha temporaria no Auth: ${updateError?.message || 'Could not update Auth user password'}`,
      });
    }

    authUser = updateData.user;
  }

  if (authUser) {
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: authUser.id,
        city_id: createdCourier.city_id,
        store_id: null,
        courier_id: createdCourier.id,
        name: createdCourier.name,
        email,
        cpf: createdCourier.cpf,
        whatsapp: createdCourier.phone,
        role: 'courier_admin',
        active: true,
        password_set_at: new Date().toISOString(),
      });

    if (profileError) {
      return json({ error: profileError.message }, 400);
    }
  }

  return json({
    ok: true,
    courier: createdCourier,
    authUserId: authUser?.id ?? null,
    mode: 'temporary_password',
    temporaryPassword: password,
    warning: null,
  });
});

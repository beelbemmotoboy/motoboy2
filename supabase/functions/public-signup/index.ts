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

function onlyDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function cleanText(value: unknown) {
  return String(value || '').trim();
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const payload = await request.json().catch(() => ({}));
  const action = String(payload.action || '');

  if (action === 'cities') {
    const { data, error } = await adminClient
      .from('cities')
      .select('id, name, state')
      .eq('active', true)
      .order('name', { ascending: true });

    if (error) return json({ error: error.message }, 400);
    return json({ cities: data ?? [] });
  }

  if (action === 'store') {
    const store = payload.store ?? {};
    const cityId = cleanText(store.city_id);
    const document = onlyDigits(store.document);
    const name = cleanText(store.name);
    const responsible = cleanText(store.responsible_name);
    const email = cleanText(store.email).toLowerCase();
    const whatsapp = onlyDigits(store.whatsapp);

    if (!cityId || !document || !name || !responsible || !email || !whatsapp) {
      return json({ error: 'Dados obrigatorios da loja incompletos.' }, 400);
    }

    const { data, error } = await adminClient
      .from('stores')
      .insert({
        city_id: cityId,
        name,
        fantasy_name: cleanText(store.fantasy_name),
        document,
        responsible_name: responsible,
        email,
        whatsapp,
        zip_code: onlyDigits(store.zip_code),
        address: cleanText(store.address),
        address_number: cleanText(store.address_number),
        district: cleanText(store.district),
        store_type: cleanText(store.store_type) || 'Restaurante',
        internal_notes: 'Pre-cadastro publico. Validar documentos e liberar acesso pelo painel.',
        active: false,
      })
      .select('id')
      .single();

    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, type: 'store', id: data.id });
  }

  if (action === 'courier') {
    const courier = payload.courier ?? {};
    const cityId = cleanText(courier.city_id);
    const name = cleanText(courier.name);
    const email = cleanText(courier.email).toLowerCase();
    const phone = onlyDigits(courier.phone);
    const cpf = onlyDigits(courier.cpf);

    if (!cityId || !name || !email || !phone || !cpf) {
      return json({ error: 'Dados obrigatorios do motoboy incompletos.' }, 400);
    }

    const { data, error } = await adminClient
      .from('couriers')
      .insert({
        city_id: cityId,
        name,
        birth_date: cleanText(courier.birth_date) || null,
        cpf,
        email,
        phone,
        vehicle_type: 'Moto',
        vehicle_plate: cleanText(courier.vehicle_plate).toUpperCase(),
        pix_key: cleanText(courier.pix_key),
        pix_key_type: cleanText(courier.pix_key_type) || 'CPF',
        pix_holder_name: cleanText(courier.pix_holder_name),
        approval_status: 'pending_approval',
        availability_status: 'offline',
        internal_notes: 'Pre-cadastro publico. Validar documentos e liberar acesso pelo painel.',
        active: false,
        available: false,
      })
      .select('id')
      .single();

    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, type: 'courier', id: data.id });
  }

  return json({ error: 'Invalid action' }, 400);
});

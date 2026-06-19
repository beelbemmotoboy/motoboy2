import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

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
    const vapidPublicKey = Deno.env.get('OBRAS_VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('OBRAS_VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('OBRAS_VAPID_SUBJECT') || 'mailto:suporte@beelbem.com.br';

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
      return json({ error: 'Configuracao da funcao incompleta.' }, 500);
    }

    const body = await request.json();
    const notificationId = String(body.notificationId || '').trim();
    if (!notificationId) return json({ error: 'Informe notificationId.' }, 400);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Sessao invalida.' }, 401);

    const { data: currentUser, error: currentUserError } = await adminClient
      .from('obras_users')
      .select('id, account_id, active, login_enabled')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();

    if (currentUserError || !currentUser?.active || !currentUser.login_enabled) {
      return json({ error: 'Usuario sem acesso ao Obras.' }, 403);
    }

    const { data: notification, error: notificationError } = await adminClient
      .from('obras_notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('account_id', currentUser.account_id)
      .maybeSingle();

    if (notificationError) throw notificationError;
    if (!notification) return json({ error: 'Notificacao nao encontrada.' }, 404);

    if (!vapidPublicKey || !vapidPrivateKey) {
      return json({ sent: 0, skipped: true, reason: 'VAPID nao configurado.' });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const { data: subscriptions, error: subscriptionError } = await adminClient
      .from('obras_push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('account_id', notification.account_id)
      .eq('active', true);

    if (subscriptionError) throw subscriptionError;

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      type: notification.type,
      url: '/obras',
      notificationId: notification.id,
      projectId: notification.project_id,
      createdAt: notification.created_at,
      payload: notification.payload || {},
    });

    const results = await Promise.allSettled((subscriptions || []).map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        }, payload);
        return true;
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await adminClient
            .from('obras_push_subscriptions')
            .update({ active: false })
            .eq('id', subscription.id);
        }
        throw error;
      }
    }));

    const sent = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - sent;
    return json({ sent, failed, total: results.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha ao enviar push.' }, 400);
  }
});

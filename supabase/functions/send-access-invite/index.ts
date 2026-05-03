import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { inviteId, email } = await request.json();
  if (!inviteId || !email) {
    return Response.json({ error: 'inviteId and email are required' }, { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const appUrl = Deno.env.get('APP_URL') || 'https://www.beelbem.com.br';
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${appUrl}/#create-password`,
    },
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await supabase
    .from('access_invites')
    .update({
      password_setup_sent_at: new Date().toISOString(),
      password_setup_expires_at: expiresAt,
      password_setup_token: data.properties?.hashed_token ?? null,
    })
    .eq('id', inviteId);

  return Response.json({ ok: true, actionLink: data.properties?.action_link });
});

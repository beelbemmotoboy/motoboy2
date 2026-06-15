import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(scriptDir, '..');
loadEnvFile(join(projectRoot, '.env.migration.local'));

const applyChanges = process.argv.includes('--apply');
const inviteUsers = process.argv.includes('--invite-users');
const sourceUrl = process.env.SOURCE_SUPABASE_URL || '';
const sourceServiceKey = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY || '';
const targetUrl = process.env.TARGET_SUPABASE_URL || '';
const targetServiceKey = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY || '';
const redirectTo = process.env.TARGET_OBRAS_REDIRECT_URL || '';
const photoBucket = 'obras-photos';

if (!sourceUrl || !sourceServiceKey || !targetUrl || !targetServiceKey) {
  throw new Error(
    'Configure SOURCE_SUPABASE_URL, SOURCE_SUPABASE_SERVICE_ROLE_KEY, '
    + 'TARGET_SUPABASE_URL e TARGET_SUPABASE_SERVICE_ROLE_KEY em .env.migration.local.',
  );
}

if (sourceUrl === targetUrl) {
  throw new Error('Origem e destino apontam para o mesmo projeto Supabase.');
}

if (inviteUsers && !applyChanges) {
  throw new Error('Use --invite-users junto com --apply para confirmar o envio dos convites.');
}

const source = createClient(sourceUrl, sourceServiceKey, adminClientOptions());
const target = createClient(targetUrl, targetServiceKey, adminClientOptions());

const tables = [
  'obras_accounts',
  'obras_users',
  'obras_projects',
  'obras_stages',
  'obras_photos',
  'obras_pls_items',
  'obras_issues',
  'obras_supplies',
  'obras_tools',
  'obras_checklist',
];

const sourceRows = new Map();
for (const table of tables) {
  const rows = await fetchAllRows(source, table);
  sourceRows.set(table, rows);
  console.log(`${table}: ${rows.length} registro(s) na origem`);
}

validateSourceData(sourceRows);

if (!applyChanges) {
  console.log('\nSimulacao concluida. Nenhum dado foi alterado.');
  console.log('Use "npm run migrate:apply" somente depois de aplicar o schema no Supabase Obras.');
  process.exit(0);
}

for (const table of tables) {
  const rows = sourceRows.get(table).map((row) => sanitizeRow(table, row));
  await upsertRows(target, table, rows);
  console.log(`${table}: copia concluida`);
}

const photos = sourceRows.get('obras_photos').filter((photo) => photo.storage_path);
let copiedPhotos = 0;
for (const photo of photos) {
  const { data: file, error: downloadError } = await source.storage
    .from(photoBucket)
    .download(photo.storage_path);
  if (downloadError) {
    throw new Error(`Falha ao baixar ${photo.storage_path}: ${downloadError.message}`);
  }

  const { error: uploadError } = await target.storage
    .from(photoBucket)
    .upload(photo.storage_path, file, {
      contentType: photo.mime_type || file.type || 'application/octet-stream',
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`Falha ao enviar ${photo.storage_path}: ${uploadError.message}`);
  }
  copiedPhotos += 1;
}
console.log(`Storage: ${copiedPhotos} foto(s) copiada(s)`);

if (inviteUsers) {
  await inviteTargetUsers(target, sourceRows.get('obras_users'));
}

let verificationFailed = false;
for (const table of tables) {
  const targetCount = await countRows(target, table);
  const sourceCount = sourceRows.get(table).length;
  const matches = targetCount === sourceCount;
  verificationFailed ||= !matches;
  console.log(`${table}: origem=${sourceCount}, destino=${targetCount}${matches ? '' : ' [DIVERGENTE]'}`);
}

if (verificationFailed) {
  throw new Error('A copia terminou com divergencia de contagem. Nao troque as variaveis do aplicativo.');
}

console.log('\nMigracao e verificacao concluidas.');
console.log('Mantenha o banco antigo intacto ate validar login, projetos e fotos no novo ambiente.');

function adminClientOptions() {
  return {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
}

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const separator = trimmed.indexOf('=');
    const name = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!process.env[name]) process.env[name] = value;
  }
}

async function fetchAllRows(client, table) {
  const rows = [];
  const pageSize = 1000;

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .range(start, start + pageSize - 1);
    if (error) throw new Error(`Falha ao consultar ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

async function countRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select('id', { count: 'exact', head: true });
  if (error) throw new Error(`Falha ao contar ${table}: ${error.message}`);
  return Number(count || 0);
}

function sanitizeRow(table, row) {
  if (table === 'obras_accounts') {
    return { ...row, created_by: null };
  }
  if (table === 'obras_users') {
    return { ...row, auth_user_id: null, invited_by: null };
  }
  if (table === 'obras_projects') {
    return { ...row, owner_id: null };
  }
  return row;
}

async function upsertRows(client, table, rows) {
  const chunkSize = 200;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    if (!chunk.length) continue;
    const { error } = await client.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`Falha ao copiar ${table}: ${error.message}`);
  }
}

function validateSourceData(rowsByTable) {
  const users = rowsByTable.get('obras_users');
  const emails = new Set();
  for (const user of users) {
    const email = String(user.email || '').trim().toLowerCase();
    if (!email) throw new Error(`Usuario Obras sem e-mail: ${user.id}`);
    if (emails.has(email)) {
      throw new Error(`O e-mail ${email} aparece em mais de uma conta Obras e precisa ser corrigido antes da migracao.`);
    }
    emails.add(email);
  }
}

async function inviteTargetUsers(client, users) {
  if (!redirectTo) {
    throw new Error('Configure TARGET_OBRAS_REDIRECT_URL antes de enviar convites.');
  }

  const existingAuthUsers = new Map();
  for (let page = 1; ; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Falha ao listar usuarios do destino: ${error.message}`);
    for (const user of data.users) {
      if (user.email) existingAuthUsers.set(user.email.toLowerCase(), user);
    }
    if (data.users.length < 1000) break;
  }

  for (const obrasUser of users.filter((user) => user.active && user.login_enabled !== false)) {
    const email = obrasUser.email.trim().toLowerCase();
    let authUser = existingAuthUsers.get(email);

    if (!authUser) {
      const { data, error } = await client.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { application: 'beelbem-obras', name: obrasUser.nome },
      });
      if (error) throw new Error(`Falha ao convidar ${email}: ${error.message}`);
      authUser = data.user;
      existingAuthUsers.set(email, authUser);
    }

    const { error } = await client
      .from('obras_users')
      .update({ auth_user_id: authUser.id })
      .eq('id', obrasUser.id);
    if (error) throw new Error(`Falha ao vincular ${email}: ${error.message}`);
  }

  console.log(`Auth: ${users.length} usuario(s) processado(s)`);
}

alter table public.profiles add column if not exists cpf text;
alter table public.profiles add column if not exists whatsapp text;
alter table public.profiles add column if not exists address_proof_path text;

alter table public.access_invites add column if not exists cpf text;
alter table public.access_invites add column if not exists whatsapp text;
alter table public.access_invites add column if not exists address_proof_path text;

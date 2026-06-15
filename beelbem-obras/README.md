# Beelbem Obras

Aplicacao independente para gestao de obras. O frontend, o schema do banco, as
funcoes e a implantacao podem ser executados sem depender do Beelbem Motoboy.

## Desenvolvimento

```bash
npm install
npm run dev
```

Crie `.env.local` a partir de `.env.example`:

```env
VITE_OBRAS_SUPABASE_URL=https://seu-projeto-obras.supabase.co
VITE_OBRAS_SUPABASE_ANON_KEY=sua-chave-anon-publica-do-obras
VITE_OBRAS_USER_INVITES_ENABLED=true
```

Enquanto as variaveis exclusivas nao estiverem configuradas, o aplicativo ainda
aceita `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Esse fallback existe
somente para manter o ambiente atual funcionando durante a migracao.

## Builds

Build independente do Motoboy, inclusive quando publicado em `/obras/`:

```bash
npm run build
```

Build temporario para a rota antiga `/obras/`:

```bash
npm run build:legacy
```

## Supabase exclusivo

O schema inicial esta em:

```text
supabase/migrations/202606130001_initial_obras.sql
```

Ele cria:

- contas e usuarios exclusivos do Obras;
- projetos, etapas, fotos, PLS, pendencias, insumos, ferramentas e checklist;
- isolamento por conta usando RLS;
- bucket privado `obras-photos`;
- vinculo de usuario por e-mail durante a migracao;
- funcao de bootstrap para o primeiro proprietario.

A Edge Function `invite-obras-user` cria ou convida usuarios no Auth do projeto
Obras. Ela deve ser publicada no novo projeto antes de habilitar os convites no
frontend.

## Migracao

Leia [MIGRATION.md](./MIGRATION.md) antes de trocar qualquer variavel de
producao. A ferramenta de migracao inicia em modo de simulacao e nunca remove
dados da origem.

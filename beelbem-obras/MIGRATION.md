# Migracao para o Supabase Obras

Este processo mantem o Motoboy no projeto atual. Somente tabelas, usuarios
logicos e fotos do Obras sao copiados.

## 1. Criar o novo projeto

Crie um projeto Supabase exclusivo para o Obras. Nao altere o projeto atual.

No diretorio `beelbem-obras`, vincule a CLI ao novo projeto e aplique somente as
migrations desta pasta:

```bash
npx supabase link --project-ref NOVO_PROJECT_REF
npx supabase db push
npx supabase functions deploy invite-obras-user
```

## 2. Preparar a migracao

Crie `.env.migration.local` a partir de `.env.migration.example`.

As chaves `service_role` sao administrativas. Esse arquivo esta ignorado pelo
Git e nunca deve ser colocado no frontend ou enviado ao repositorio.

Execute primeiro a simulacao:

```bash
npm run migrate:dry-run
```

Ela consulta as tabelas da origem, valida e-mails duplicados e nao grava nada.

## 3. Copiar dados e Storage

Depois de revisar a simulacao:

```bash
npm run migrate:apply
```

O comando:

- preserva IDs das contas, projetos e registros filhos;
- remove referencias aos UUIDs antigos do Auth;
- copia o conteudo do bucket `obras-photos`;
- compara as contagens da origem e do destino;
- interrompe o processo se encontrar divergencia.

O processo nao exclui nem altera registros do projeto atual.

## 4. Migrar acessos

As senhas do Auth antigo nao devem ser reutilizadas. Envie convites pelo novo
projeto:

```bash
npm run migrate:invite
```

Esse comando envia e-mails. Execute apenas depois de configurar
`TARGET_OBRAS_REDIRECT_URL=https://www.beelbem.com.br/obras/`.

Ao entrar pela primeira vez, `obras_claim_user()` vincula o novo UUID do Auth ao
cadastro copiado pelo e-mail.

## 5. Validar antes da troca

Confira no novo ambiente:

1. Login do proprietario e de um usuario comum.
2. Quantidade de contas, usuarios e obras.
3. Abertura de etapas e pendencias.
4. Visualizacao e envio de fotos.
5. Restricao entre contas diferentes.
6. Cadastro de usuario e recebimento do convite.

## 6. Trocar somente o Obras

Configure no projeto de deploy independente:

```env
VITE_OBRAS_SUPABASE_URL=https://novo-projeto-obras.supabase.co
VITE_OBRAS_SUPABASE_ANON_KEY=chave-anon-do-novo-projeto
VITE_OBRAS_USER_INVITES_ENABLED=true
```

Publique o Obras na rota `https://www.beelbem.com.br/obras/`. O Motoboy
continua usando suas variaveis atuais.

## 7. Retorno

Se a validacao falhar, restaure o deploy anterior do Obras. Como a origem nao e
alterada pela ferramenta, o sistema volta a consultar o banco antigo.

Mantenha as tabelas `obras_*` e o bucket antigo por pelo menos 30 dias. Somente
depois desse periodo considere remover o legado em uma migration separada.

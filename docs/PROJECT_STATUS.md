# Retomada do desenvolvimento — 21/11/2026

## Escopo e evidências

Revisão do histórico disponível nesta conversa, commits, árvore remota e CI. Não representa acesso a todas as conversas de outras sessões. O terminal do ambiente falhou ao iniciar nesta retomada; não foi possível verificar checkout/alterações locais nem executar testes locais. As alterações deste lote partem exclusivamente do HEAD remoto da PR #12, sem substituir arquivos de outro checkout.

- Main: `6f42a06`, merge da PR #10; PR #9 melhorou a home.
- PR #8 integrada em `0ff86bc`; CI `43225538727` aprovada.
- PR #12: branch `feat/task-04c-provisioning`, draft; HEAD revisado `df00a1a9eaf370cb01b9ab0a70984affe545e187`.
- CI desse HEAD: [44911997216](https://github.com/thiagocanali/pagino/actions/runs/44911997216), completed/success. Não comprova entrega completa nem homologação remota.

## Estado efetivo

A main contém documentação, Nuxt/Nitro, persistência/RLS, autenticação e recuperação/verificação local de e-mail. A arquitetura mantém Better Auth como única identidade; a branch 04-C documenta a direção posterior para Neon PostgreSQL, sem substituir a identidade por Neon Auth. A escolha de armazenamento de mídias exige confirmação própria; não inferir que PostgreSQL também entrega object storage.

Na PR #12, o serviço offline provisiona instituição/site/convite/auditoria com idempotência e entrega serializada. Roles LOGIN NOINHERIT delegam às roles restritas e verificam grants. As migrations 0007/0008 estão no journal: executor dedicado valida sessão no PostgreSQL e a função de elegibilidade permite cadastro apenas para convite enviado, ativo, não usado e não expirado.

`registerInvitedOwner` cria credenciais com hash Better Auth e usuário não verificado, sem membership. Integração existente em `tests/integration/auth.test.ts` exercita cadastro concorrente, verificação, login e aceite interno com cookie real. Isso é teste de serviço com PostgreSQL real, não jornada de navegador para onboarding.

**O endpoint POST /api/invitations/accept continua 503**, e não há endpoint/página de cadastro por convite. Portanto 04-C permanece incompleta e a PR continua draft. A descrição histórica da PR e trechos anteriores do roadmap que dizem que o executor interno ainda não existe foram superados pelos commits 6b46137, 9e43fb7 e df00a1a; o bloqueio HTTP continua correto.

## Continuação deste lote

1. Cobrir rejeição do cadastro para entrega pending/failed.
2. Cobrir expiração e consumo anterior sem criação de identidade ou membership.
3. Cobrir instituição suspensa e token incorreto.
4. Provar que lookup de elegibilidade não expõe usuários/convites nem concede EXECUTE aos runtimes.
5. Cobrir payloads de promoção, entrada inválida e ausência de transporte de verificação.
6. Consolidar evidências e próximos passos na mesma PR; validar CI no novo HEAD.

Nenhum endpoint foi habilitado, segredo configurado, migration remota aplicada ou deploy solicitado neste lote. Resultados novos só são aprovados após CI do SHA correspondente.

## Próximo incremento funcional

Conectar a jornada pública exclusivamente por convite: endpoint de cadastro e página para token em fragmento; origem/CSRF, limite de corpo, rate limit persistente, respostas sem enumeração e logs sem segredo; envio de verificação pelo transporte existente; retorno ao login/aceite com sessão real; habilitação do aceite somente após matriz negativa e E2E desktop/mobile. Completar CLI operacional e snapshots Drizzle sem drift. Revisar privilégios explicitamente antes de remover draft.

Depois: 04-D equipe/permissões; 05 configurações; 06 institutional-classic; 07 CMS/eventos/mídias/publicação; 08 auditoria operacional e piloto. Não refazer login, recuperação ou provisionamento já existentes.

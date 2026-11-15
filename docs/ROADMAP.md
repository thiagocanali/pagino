# Roadmap de implementação

Estado em 12/11/2026. A numeração vigente segue as fases solicitadas pelo proprietário. P0 indica fundação/segurança ou gate de liberação; P1 indica incremento de produto. Cada linha futura deve resultar em comportamento demonstrável, validação e PR revisável.

## Entregue e validado

| Fase | Estado e evidência |
| --- | --- |
| TASK 01 — Fundação documental | 13 documentos, decisões, requisitos e critérios de aceite; PR #1 integrada |
| TASK 02 — Fundação técnica | Nuxt/Vue/TypeScript/Nitro, layouts, validação, erros, CI; PR #3 integrada |
| TASK 03 — Persistência/multi-tenancy | Núcleo institutions/memberships/sites/pages/audit, schema Better Auth, FKs compostas, roles restritas e FORCE RLS; #4 entrou na branch 02 e #5 concluiu integração na main |
| TASK 04 — Autenticação/permissões | Login/logout, sessão, roles e leitura institucional na PR #6; incremento 04-B implementa recuperação/verificação com transporte local e links de uso único; convites/provisionamento ainda pendentes |

A base 03 implementa o núcleo, não todas as entidades futuras do CMS. Novos módulos acrescentarão migrations próprias. Escrita de auditoria e testes negativos de isolamento acompanham cada mutação desde a primeira implementação; não serão adiados para a fase 08.

CI da persistência: run 43204551451, aprovado. CI do acesso: run 43205402954, aprovado — 34 unitários, 25 integrações PG e 18 E2E, lint/tipos e builds Node/Vercel. Fixtures são sintéticas e bancos descartáveis; integração remota não está comprovada. Deploy Git bloqueado pela PR #2; a aplicação não foi publicada.

## Próximos incrementos

| ID / prioridade | Incremento funcional e aceite | Dependências | Riscos e testes |
| --- | --- | --- | --- |
| **04-C / P0** | **Provisionamento** assistido de instituição/site/primeiro owner e convite vinculado ao destinatário; retry sem duplicar | 04-B | Comando operacional restrito, auditoria, idempotência, e-mail correto, falha de entrega recuperável; nenhum superadmin público |
| 04-D / P0 | Equipe: convidar, aceitar, reenviar, revogar e transferir ownership conforme matriz | 04-C | Papéis por tenant, admin sem promoção de owner, duas remoções simultâneas não eliminam último owner, reautenticação e convites expirados/reutilizados |
| 05-A / P1 | Gestão institucional e configurações persistidas no painel; estados vazio/erro/sucesso; suspensão operacional bloqueia painel/público | 04-C, 04-D | Validação de servidor, conflitos, auditoria e isolamento A/B em chamadas diretas |
| 05-B / P1 | Gestão de equipe no painel com ações reais e mensagens compreensíveis | 04-D | Botões por permissão, backend independente da UI, revogação imediata, acessibilidade por teclado |
| 06-A / P1 | institutional-classic@1 com tokens de marca, tipografia de catálogo e preview privado, sem depender de imagem ainda indisponível | 05-A | Schema inválido/versionado, contraste, responsividade, XSS e independência entre tenants |
| 07-A / P1 | CMS de páginas/navegação/SEO: criar, editar, arquivar, salvar rascunho e preview | 06-A | Rotas reservadas, slug único, sanitização, optimistic locking, conflito sem perda silenciosa e auditoria |
| 07-B / P1 | Eventos informativos persistidos, listagem/detalhe e arquivo | 07-A | UTC + timezone IANA, DST, fim/início, paginação, isolamento e rascunho sem alteração pública |
| 07-C / P0 | Biblioteca de mídias e integração de logo/imagens: upload assinado, derivado seguro, alt, quota e exclusão protegida | 05-B, 07-A; Storage autorizado para prova remota | MIME/bytes/dimensões/EXIF, quota concorrente, path cruzado, falha DB/Storage, órfãos e referências. Fake não encerra validação Storage |
| 07-D / P0 | Publicação por snapshot completo em /s/{slug}, checklist, retirada e restauração para rascunho | 07-A–C | Atomicidade, idempotência, corrida com edição, público sem drafts, no-store, links de mídia com TTL e versão anterior preservada |
| 08-A / P1 | Interface de auditoria com filtros/paginação e autoria compreensível | 05–07; escrita já implementada em cada módulo | Roles owner/admin, redação, append-only, isolamento e paginação estável |
| 08-B / P0 | Homologação integrada em preview autorizado do projeto existente | 04–07; gates abaixo | Cookies HTTPS, IP/proxy, Supavisor, e-mail e Storage reais; navegador → API → dados; proteção Vercel e alias confirmados |
| 08-C / P0 | Piloto operacional e publicação autorizada: restauração ensaiada, acessibilidade/usabilidade, métricas e runbook | 08-A/B; revisão humana | Backup de banco **e objetos**, RPO/RTO, custos/plano, LGPD, isolamento completo, retirada/rollback e instituição piloto real |

## Gates externos

- Identificar Supabase específico; se inexistente, preparar proposta de nome/região/ambientes/custo e pedir autorização antes de criar. Não usar bancos de outros produtos.
- Selecionar transporte de e-mail e validar remetente/domínio, custo e entregabilidade antes do piloto. Coletor local comprova o fluxo de desenvolvimento, não entrega comercial.
- Reutilizar Vercel pagino. Confirmar alias inicial, runtime, proteção e acesso de visitante. Não alterar segurança ou criar projeto para contornar bloqueios.
- Confirmar elegibilidade comercial do plano e capacidade de backups/Storage; serviço pago exige autorização.
- Revisar dependências, TLS, proxy/IP confiável, limite upstream de corpo, retenção, termos/LGPD e recuperação antes de dados reais.
- Produção continua sem autorização; build/merge não devem disparar deploy automático. Previews usam recursos isolados, nunca credenciais de produção ou de outros projetos.

## Regras de execução

Uma branch/PR por incremento, commits descritivos, checks apropriados e revisão antes do merge. Sem force push ou migrations em build/preview. Testar em Postgres real descartável; mocks não comprovam RLS, pooling ou Storage. Preservar identidade única Better Auth, contexto de tenant por requisição/transação e snapshot público separado do rascunho.

Se um gate externo bloquear um incremento, documentar a ação necessária e executar trabalho independente. Não declarar a fase ou o MVP concluído apenas porque o scaffold ou a CI passaram. O histórico da sequência inicial e das integrações está no Git e em DECISIONS.md.

## Incremento 04-B — implementado em desenvolvimento

Recuperação/verificação com transporte HTTP local real, coletor CLI privado, links opacos e consumo transacional. Senha/sessões e todos os links irmãos são atualizados atomicamente; login usa o mesmo lock de usuário para impedir que uma corrida preserve sessão com senha antiga. Suíte local: 95 testes (39 unidade, 34 PG, 22 navegador), lint/tipos e builds.

Próxima entrega 04-C: provisionamento assistido e convite do primeiro owner. O incremento 04-B não configura entrega externa: provider real, fila/retries operacionais, retenção/purga e homologação continuam gates antes do piloto. Respostas genéricas e piso de 500 ms reduzem enumeração, sem promessa de latência constante sob falha de transporte; transporte externo requer revisão própria.

## 04-C — estado verificável e ordem de desbloqueio (15/11/2026)

- **CI histórica:** run `43508060910` verde no commit `91fbbb5`; isso valida somente aquele SHA. Os commits recentes da branch exigem CI verde própria.
- **Implementado na branch:** migrations 0004–0006, schema do convite inicial, idempotência e auditoria operacional, função SQL transacional, role de operador delegada, logins NOINHERIT separados para app/auth, validação de `current_user` e `session_user`, e testes de integração para privilégios.
- **Neon isolado:** migrations 0000–0006 aplicadas na branch não padrão `pagino-task-04c-validation`; catálogo confirmou RLS/FORCE RLS, grants restritos e atributos dos logins. Nenhuma migration foi aplicada na branch principal.
- **Bloqueado por segurança:** endpoint HTTP de aceite responde 503; cadastro público Better Auth permanece desligado. A função `SECURITY DEFINER` não recebe `EXECUTE` das roles de runtime. A função SQL atual ainda recebe user ID como argumento; falta prova de identidade verificável pelo banco, sem aceitar ID arbitrário.
- **Bloqueado operacionalmente:** os logins `app_runtime_login`, `auth_runtime_login` e `provision_operator_login` foram criados apenas na branch Neon isolada. As senhas e secrets de execução não foram configurados; não reutilizar credenciais de migração nem outros produtos.
- **Correção em progresso:** Postgres.js recebe a role assumida pelo parâmetro de startup `connection: { role: 'app_runtime' | 'auth_runtime' | 'provision_operator' }`. A forma anterior com `connection.options` não aplicava a role corretamente; o CI encontrou a falha de permissão de schema e a implementação foi corrigida. A validação final desse ajuste está pendente de CI.
- **Sequência P0:** (1) fechar CI completa, incluindo E2E auth; (2) projetar execução de aceite com identidade DB-verificável e sem `user_id` arbitrário; (3) exercitar SQL direto com logins dedicados, concorrência, replay, expiração e falha de auditoria; (4) concluir CLI offline, rotação/reenvio e recuperação idempotente; (5) E2E ponta a ponta e revisão de segurança.
- **Gates externos:** configurar credenciais e secrets no Neon por procedimento seguro; transporte real de e-mail, homologação Vercel e autorização de preview/deploy permanecem pendentes.

### 04-C — validação transacional do operador (15/11/2026)

Os testes de integração exercitam a role delegada em PostgreSQL descartável, criando instituição, site, convite pendente, chave de idempotência e evento de auditoria na mesma transação. Um teste adicional força rejeição da auditoria pela policy RLS e exige rollback da instituição e do site. Isso não configura credencial operacional nem habilita o aceite do convite.

### Política de deploy econômico — Vercel (15/11/2026)

- **Inspeção direta:** projeto Vercel `pagino` (`prj_8C845XPhi7RkURdCHPzV7Oi8nVqc`), com 3 deployments retornados: dois de produção e um preview antigo; nenhum deployment encontrado para `feat/task-04c-provisioning`. O último de produção está `READY`, mas isso não valida serviços externos.
- **Controle existente:** `vercel.json` contém `git.deploymentEnabled: false`; manter a integração Git sem deploy automático enquanto o projeto não estiver pronto. Não ativar preview a cada commit, nem mudar configurações de produção para economizar cota.
- **CI como gate:** `.github/workflows/ci.yml` executa lint, typecheck, unidade, PostgreSQL descartável, builds Nuxt/Vercel e Playwright. A execução `43742809039` passou no SHA `d715945`. Commits intermediários podem cancelar jobs anteriores por `concurrency.cancel-in-progress`; agrupar mudanças coerentes antes de push reduz desperdício de CI.
- **Política operacional:** fazer commits locais agrupados e push por conjunto validável; reservar previews manuais e autorizados para testes que dependam da hospedagem, preferencialmente após CI verde. Nunca repetir deploy quando houver bloqueio de cota; continuar desenvolvimento/testes sem Vercel.
- **Limite da conclusão:** a inspeção de deployments mostra que esta branch não gerou previews recentes; não demonstra que outros projetos da conta não estejam consumindo a cota. Revisar a configuração Git Deployment por branch/ambiente no painel antes de qualquer futura ativação, sem alterar produção ou proteções.

## Ciclo de execução em lotes — 15/11/2026

| Prioridade | Entrega | Estado | Evidência e próximo passo |
| --- | --- | --- | --- |
| P0 | CI anterior do provisionamento | Validada | Run 43750685499, SHA eea5b4b, success |
| P0 | Persistência do status de entrega de convite | Em andamento | UPDATE condicional e RETURNING; aguarda CI do HEAD |
| P0 | Verificação de privilégios do login operacional | Em andamento | Validação de current_user e session_user, com testes unitários; aguarda CI |
| P0 | Aceite de convite vinculado a identidade segura | Bloqueada | Função SQL atual recebe user ID falsificável; endpoint 503 permanece fechado |
| P1 | Migrations e RLS em branch Neon isolada | Pendente | Não aplicar migrations no banco principal; revisar compatibilidade e papéis |
| P1 | Bootstrap delegado da role NOLOGIN | Pendente | Projetar login mínimo com SET ROLE transacional, sem grants de runtime |
| P1 | CI do lote final | Pendente | Verificar run do SHA final, corrigir eventuais falhas |

Próxima execução: acompanhar CI do HEAD e, depois, ensaiar migrations no Neon isolado. A PR #12 continua draft, sem deploy e sem merge.

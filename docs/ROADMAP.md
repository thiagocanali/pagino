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

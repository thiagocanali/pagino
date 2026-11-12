# Roadmap de implementação

Status: planejamento detalhado da TASK 01, atualizado pela missão posterior de implementação autônoma. P0 é dependência fundacional/segurança; P1 completa o MVP. Cada tarefa futura entrega comportamento demonstrável e testes, não apenas camada isolada. Trabalhar com fixtures sintéticas e PostgreSQL local até haver autorização remota. Uma PR por incremento, dividindo novamente se ficar grande.

| Task / prioridade | Incremento funcional e aceite demonstrável | Dependências | Risco e testes necessários |
| --- | --- | --- | --- |
| **02 / P0** | **Bootstrap técnico local e CI de qualidade**: Nuxt/Vue/TS/Nitro, tela técnica responsiva e health sem segredos; lockfile, scripts de lint/tipos/Vitest/Playwright/build e Actions em PR; build Vercel sem deploy | Revisão da 01 | Compatibilidade Node/Nuxt/Nitro: fixar versões estáveis, avaliar Node 24 LTS frente a 26.x observado; fresh install, smoke navegador e build |
| 03 / P0 | Prova local da stack de dados/auth: Better Auth + adapter Drizzle/PG em banco descartável, login/logout de usuário sintético e recurso protegido por tenant seed; roles auth/domínio/leitor e pool transacional comprovados | 02 | Não tratar como auth final; cookies SSR, schema gerado, ausência de contexto/RLS, rollback e reuso concorrente; decidir ADR se composição falhar |
| 04 / P0 | Acesso seguro: verificação, convite inicial de owner provisionado, recuperação, expiração/revogação, rate limiting persistente e coletor de e-mail local | 03 | Token/replay/enumeração; testar fluxo completo, expiração e revogação; produção depende de e-mail real autorizado |
| 05 / P0 | Instituições: provisionamento assistido idempotente, seleção no painel e estados vazios; suspender bloqueia acesso/site | 04 | Isolamento: duas instituições e memberships distintas, 401/403/404, slug único, criação/rollback/auditoria |
| 06 / P0 | Equipe e RBAC: convite editor/viewer/admin conforme matriz, aceite/reenvio/revogação e transferência de owner | 05 | Escalada e último owner: matriz completa, aceite concorrente, duas remoções simultâneas, revogação imediata |
| 07 / P1 | Template e marca: institutional-classic@1 com configurações persistidas e preview privado | 05 | JSON inválido, contraste, XSS, vazamento por preview; teclado/responsividade, dois tenants independentes |
| 08 / P1 | Páginas e navegação: criar/editar/arquivar, SEO básico e preview; conflitos preservam trabalho | 07 | Slugs/rotas reservadas, sanitização, optimistic locking e referências de mídia preparadas |
| 09 / P1 | Eventos informativos no painel e preview: lista/detalhe, timezone e arquivo | 08 | Fim/início e DST, validações, paginação e tenant A/B |
| 10 / P0 | Mídias: upload direto assinado, validação/derivado seguro, alt, quota, seleção e exclusão protegida; reconciliação manual idempotente | 06, 08, 09; Storage autorizado para prova remota | MIME falso, EXIF, dimensão, quota concorrente, cross-tenant, falhas DB/Storage e referências; local fake só auxilia, não encerra verificação Storage |
| 11 / P0 | Publicação: snapshot completo e rota pública /s/{slug}, checklist, retirada e restauração em rascunho | 06–10 | Atomicidade, idempotência, leitura só snapshot ativo, corrida edição/publicação, cache no-store e mídia privada; E2E editor → admin → visitante |
| 12 / P1 | Consulta de auditoria com filtros/paginação e linguagem compreensível | 06, 11 | Isolamento, permissões, redação e imutabilidade; auditoria de escrita já obrigatória desde a 03, não adiada para cá |
| 13 / P0 | Homologação integrada em preview do projeto existente: sessão/e-mail reais, DB/Storage dedicados, health e diagnóstico sem dados sensíveis | 02–12; gates de recursos abaixo | Smoke browser → API → DB → Storage; proteção Vercel, alias, cookies HTTPS, pooling real e isolamento; nenhum dado de produção |
| 14 / P0 | Piloto operacional: backup/restauração comprovados, acessibilidade/usabilidade revisadas, publicação pública autorizada e runbook de incidente | 13; revisão humana | Custo/limites/plano comercial, métricas RNF, LGPD, recuperação, retirada e rollback; produção somente com gates atendidos |

## Gates externos e paralelismo seguro

- Antes de usar cloud: identificar projeto Supabase específico; se não existir, pedir autorização explícita com nome/região/ambientes/custo. Não reutilizar projetos de outros produtos.
- E-mail: selecionar serviço e validar custo/domínio/entregabilidade antes de ativar convites/reset em produção. Coletor local não substitui envio real.
- Preview: reutilizar projeto Vercel pagino; confirmar vínculo Git/alias paginoo.vercel.app, runtime e proteção SSO. Segredos somente em ambientes autorizados e nunca em PR de fork. Não remover proteção nem criar projeto para contornar bloqueio.
- Confirmar elegibilidade do plano Vercel para uso comercial; se houver necessidade de plano pago, apresentar decisão ao proprietário. Nada contratado por este roadmap.
- Contratos e RLS da 03 devem ser aprovados antes de desenvolver módulos. 06 e 07 podem avançar separadamente após 05, mantendo contratos comuns; não é instrução para criar subagentes.

## TASK 02 em detalhe

**Objetivo:** repositório executável localmente e verificação automática reproduzível, sem funcionalidades institucionais ou recursos remotos.

Entregáveis: scaffold Nuxt estável com Vue 3/TypeScript/Nitro; Node e gerenciador fixados; lockfile; página técnica acessível; GET health sem consultar serviços; teste unitário significativo de contrato health e smoke Playwright da página; lint/tipos/build; Actions com permissões mínimas, sem deploy/migration e sem secrets; README com comandos reais.

Aceite: clone limpo instala por lockfile, executa checks e build Nitro/Vercel, inicia localmente e passa smoke no navegador. CI de PR reproduz verificações. Versões/runtime resolvidos e registrados em ADR. Não criar Supabase, configurar cobrança, alterar Vercel ou implementar login nesta task.

## Riscos de sequência

A 03 é um gate de compatibilidade, não uma promessa de integração pronta. Se adapter/roles/pool não compuserem corretamente, resolver com ADR antes de dados reais. Storage privilegiado e links temporários exigem verificação específica; não assumir que RLS do domínio protege Storage. Operação comercial, backup e LGPD não podem ser adiados para depois do primeiro cliente.

## Agrupamento vigente solicitado pelo proprietário

A missão posterior mantém os incrementos pequenos da tabela, agrupados por fases: TASK 02 = bootstrap/layouts/componentes/validação/erros/CI; TASK 03 = persistência e multi-tenancy (inclui prova local da stack e RLS); TASK 04 = autenticação/permissões; TASK 05 = painel; TASK 06 = templates; TASK 07 = CMS/eventos/mídia/publicação; TASK 08 = qualidade/piloto. Números 04–14 da tabela anterior passam a ser IDs históricos de incrementos, não substituem os novos nomes de fase. Implementar auditoria de escrita desde a primeira mutação, embora sua interface e validação completa pertençam à fase 08. Dependências de auth devem ser resolvidas antes de expor dados do painel.

O limite inicial de revisão automática foi resolvido no mesmo fluxo; documentação publicada na PR #1. Merge da PR #2 foi rejeitado pela revisão automática por aplicar a proibição inicial de merge. Aguardar autorização explícita em chat, sem contornar o controle. Recursos Supabase e e-mail continuam pendentes.

## Progresso verificado nesta sessão

- TASK 01: 13 documentos publicados na PR #1; merge ainda pendente.
- Guard de deploy: PR #2 bloqueia deploys automáticos Git, validado contra schema oficial. Merge bloqueado pela revisão automática; autorização específica solicitada.
- TASK 02: incremento funcional local validado (21 testes unitários, 8 E2E desktop/mobile, lint, tipos e builds Node/Vercel); publicado em branch própria. Não há autenticação nem instituição conectada à UI.
- TASK 03, incremento inicial: núcleo persistente com instituições/memberships/sites/páginas/auditoria; schema oficial Better Auth em pagino_auth, FKs compostas, roles restritas, RLS e contexto transacional. 14 testes de integração em PG 17.11 descartável aprovados. Login do adapter validado apenas como prova técnica, sem expor rota/UI de auth.
- Próximo incremento: TASK 04, login/logout/sessões e vínculo seguro do contexto de tenant ao usuário autenticado, seguido de verificação, recuperação e convites. Antes de integração remota: autorização de Supabase específico e serviço de e-mail. Demais modelos do CMS/publicação serão migrations incrementais das respectivas fases.
- Nenhum merge ou deploy manual executado; nenhuma aplicação Nuxt publicada. A Vercel gerou automaticamente produção do README-base (016a50f, antes da nova missão) e preview de documentação (e39e9eb). Nenhum projeto Supabase/serviço pago criado nem banco existente alterado.

CI remota da TASK 02 aprovada: https://github.com/thiagocanali/pagino/actions/runs/43067857515 (commit 5d8c99f). PRs abertas: #1 documentação, #2 bloqueio de deploy Git e #3 fundação técnica. Merge da #2 rejeitado por controle automático; pedido de autorização explícita em chat permanece pendente.

## Atualização após confirmação em chat e início da TASK 04

PRs #2 (bloqueio de deploy Git) e #1 (documentação) integradas. #3 e #4 seguem abertas: revisão automática rejeitou o merge da #3 por entender que a confirmação cobria somente #2/#1; aprovação específica solicitada.

Primeiro incremento da TASK 04 implementa login/logout, sessão, matriz de permissões, seleção de instituição e leitura autorizada de rascunhos. Faltam recuperação, convites, envio/verificação de e-mail e provisionamento operacional; não considerar a fase completa. A próxima entrega deve ligar esses fluxos com coletor local verificável, mantendo gate de transporte real antes de produção.

## Estado em 12/11/2026

PRs #1 e #2 integradas na main; #3 já integrada. #4 foi integrada em feat/task-02-fundacao-tecnica depois do fechamento da #3. A continuação #5 passou na CI (run 43204551451) e integrou a mesma árvore de persistência na main (merge 2d2ac27). O núcleo 03 está na branch principal.

Incremento 04 preparado com sessões, login/logout, roles, workspace institucional somente de leitura e rate limiting atômico. Validação local: 34 unitários, 25 integrações Postgres e 18 testes de navegador (10 da fundação/sem configuração, 8 com autenticação e banco). Sem projeto Supabase novo, sem migration em banco existente e sem deploy. Próximo incremento da fase 04: recuperação/verificação, convites e provisionamento operacional, começando por transporte local testável e mantendo autorização de serviço real antes do piloto.

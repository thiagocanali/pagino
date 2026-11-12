# Registro de decisões

Data-base: 11/11/2026. Status das ADRs: **propostas para revisão**, não implementação aprovada. Cada mudança futura deve registrar contexto, alternativas, consequência e evidência. Decisão revisada não deve ser apagada.

| ADR | Decisão e justificativa | Alternativa considerada / consequência |
| --- | --- | --- |
| 001 | Monólito modular Nuxt/Vue 3/TypeScript + Nitro no projeto Vercel existente; reduz operação e mantém SSR/API integrados | SPA + API separada aumenta fronteiras e deploys sem ganho no MVP; sem microsserviços |
| 002 | PostgreSQL compartilhado com institution_id, FKs compostas e RLS por contexto transacional | Banco/schema por tenant aumenta custo/operação; filtro apenas na aplicação deixa erro de escopo sem segunda barreira |
| 003 | Better Auth como única identidade, adapter Drizzle PostgreSQL; membership é domínio Pagino | Supabase Auth reduziria integração nativa com RLS/Storage, mas foi descartado para manter stack avaliada e controle central; custo é contexto explícito no servidor. Não misturar ambos |
| 004 | Drizzle e migrations revisáveis; roles separadas e pooling transacional no runtime | Conexão postgres/owner invalidaria defesa RLS; ORM não elimina necessidade de grants e constraints; prepared statements e APIs devem ser validados por versão |
| 005 | Sem Data API direta; RLS usa contexto definido pelo Nitro, não auth.uid implícito | JWT Better Auth não é sessão Supabase. Federação/JWT externo adicionaria superfície e não é necessário para API server-side |
| 006 | Supabase Storage privado, adaptador privilegiado isolado e uploads assinados por chave exata | Bucket público simplifica entrega mas expõe drafts; integração JWT externa adiada. Credencial privilegiada ignora RLS e exige autorização explícita |
| 007 | Papéis fixos owner/admin/editor/viewer por instituição | ACL customizada e plugin concorrente de organizações aumentam complexidade. Operador da plataforma é identidade operacional separada |
| 008 | Um site/tenant, institutional-classic@1, configuração por schema e renderer de código | Editor livre aumenta risco XSS e custo de UX; evoluir templates por versões preservando snapshots |
| 009 | Publicação por snapshot imutável e ponteiro atômico; restauração gera rascunho | Ler draft com flag publicada pode misturar versões e vazar mudanças. Sem cache compartilhado de dados mutáveis no MVP |
| 010 | Roteamento inicial /s/{slug} no host informado; painel central | Subdomínios/domínios próprios exigem DNS/host mapping e não são necessários no MVP; slug estável sem redirecionamentos |
| 011 | Auditoria append-only transacional; histórico restaurável por publicação | Histórico de cada edição de draft e event sourcing completos são excesso para MVP; não prometer reconstrução por auditoria |
| 012 | GitHub Actions, Vitest, PG real descartável e Playwright | Mocks não verificam RLS/pooling/SSR; cloud e plano pagos dependem de autorização; sem deploy/migration automático em PR |
| 013 | Bootstrap mínimo README na main só para criar história-base; documentação completa em branch/PR, merge apenas após validação | Repositório inicialmente sem commits não permite PR. Nenhuma funcionalidade foi introduzida na base |

## Evidência observada

- GitHub retornou branches vazias; default declarado main; repositório público.
- Vercel pagino existe, latestDeployment nulo e listagem de deployments vazia; framework nulo, Node 26.x, SSO habilitado. Não alterado.
- Supabase: nenhum projeto listado identificado como Pagino; não inspecionados schemas nem dados de outros produtos.
- Fontes oficiais consultadas confirmam Nuxt/Nitro na Vercel e adapters Better Auth/Nuxt/Drizzle; [arquitetura](ARCHITECTURE.md) registra links e limites dessa evidência.

## Pendências e gates

| Questão | Responsável esperado | Momento e impacto |
| --- | --- | --- |
| Versões exatas Nuxt/Nitro/Better Auth/Drizzle/driver e Node LTS | Implementação + revisor técnico | Fixar ferramentas na 02; dependências de auth/dados na 03; teste de compatibilidade antes dos módulos |
| Projeto Supabase, região e isolamento de ambientes | Proprietário | Identificar ou autorizar antes de integração remota; não bloqueia bootstrap local |
| Serviço de e-mail e domínio de remetente | Proprietário + implementação | Antes de auth real em piloto; coletor local só em dev |
| Alias inicial, vínculo Git e proteção Vercel | Proprietário + implementação | Antes de preview público; sem alteração nesta tarefa |
| Plano elegível comercialmente e custos de Storage/backups | Proprietário | Antes do piloto; não ativar serviço pago implicitamente |
| Retenção, termos/LGPD, RPO/RTO | Produto + responsável operacional/legal | Revisar proposta de segurança antes de dados reais |
| Cores, famílias tipográficas e conteúdo do template | Produto/design | Validar na 07 com acessibilidade; manter limites de schema |

## Revisão

Alternativa Better Auth vs Supabase Auth pode ser reavaliada se prova da 03 indicar custo/risco incompatível. Nesse caso, aprovar nova ADR com migração de identidade, RLS e Storage; nunca adicionar autenticação paralela silenciosamente.

## Atualização da missão

O proprietário autorizou implementação progressiva e merges após validação, substituindo a restrição inicial de não realizar merge da primeira PR. Continua proibido deploy em produção sem autorização explícita. A numeração de fases 03–08 passa a seguir a missão posterior, com os incrementos detalhados preservados no roadmap. Falha de revisão automática por limite de uso bloqueou publicação remota nesta sessão, sem julgamento de risco; não contornar o controle.

## ADR 014 — Bootstrap local implementado

Node 24.22.1/npm 11.9.0, Nuxt 4.6.4 (Nitro 2.13.6/Vite 8.3.8 no lockfile), Vue 3.5.45, TypeScript 5.9.3, Zod 4.6.7, ESLint 10.14.0, Vitest 5.1.0 e Playwright 1.65.0. Versões exatas e dependências transitivas em package-lock.json. ESLint 9 inicialmente escolhido estava sem suporte; substituído por 10, compatível com o módulo Nuxt. Imports comuns usam alias oficial #shared, após falha observada no bundle com caminho relativo. Sem fontes remotas, analytics, integração Sites, banco ou deploy.

Validação de configuração é stateless e explicitamente não cadastra instituição. O endpoint público desta fase não acessa dados; ele rejeita origem divergente, JSON inválido, campos extras e corpo maior que 8 KiB (checagem de Content-Length e bytes lidos; limite de buffering upstream deve ser revisto antes de exposição em produção). Não habilitar endpoints de domínio antes da autenticação/autorização.

## ADR 015 — Prova local de persistência

Drizzle ORM 0.45.4, drizzle-kit 0.31.11, postgres.js 4.1.1, Better Auth e adapter 1.7.20. Schema de identidade gerado por auth@1.7.20, adaptado somente para schema próprio pagino_auth e timestamps com timezone. Login real por role auth_runtime provou o mapeamento; não há handler público de autenticação. Migrations iniciais geradas por Drizzle, políticas/roles em migration customizada revisável. Sem db:push ou migration em build.

A prova local usa conexão direta PostgreSQL com pool de aplicação e prepare:false; valida contexto transacional e concorrência, mas não substitui teste do Supavisor e Vercel reais. Roles são NOLOGIN na migration; o teste atribui senhas efêmeras em memória apenas ao container descartável. Identidades/credenciais de runtime cloud deverão ser provisionadas por procedimento administrativo autorizado.

A PR #2 contém git.deploymentEnabled=false conforme schema oficial Vercel. Ela impede deploy Git automático enquanto produção não está autorizada. Não muda segurança nem cria serviço. Merge foi rejeitado pela revisão automática por aplicar a proibição inicial; aguardando autorização explícita em chat.

## Correção do registro de deployments

Consulta posterior à Vercel confirmou READY para o deployment automático de produção do README-base 016a50f (gerado antes da nova missão) e preview de documentação e39e9eb. A afirmação anterior de ausência de qualquer deployment após os pushes estava incorreta. Não foi executado deploy manual nem publicada a aplicação Nuxt. Não remover deployments ou alterar proteção para ocultar o efeito; registrar e manter PR #2 como gate antes de merge de código na main.

## ADR 016 — Acesso por sessão e contexto de tenant (incremento 04)

Handler Nitro expõe somente login e logout Better Auth. Cadastro, recuperação e demais endpoints ficam indisponíveis até implementação completa. Login exige e-mail verificado. Sessões duram no máximo 7 dias, sem renovação deslizante ou cookie cache; cada API privada consulta a sessão real. DTO de usuário contém só id/nome/e-mail, sem token ou objeto de sessão.

Roles de conexão são verificadas ao iniciar: nomes auth_runtime/app_runtime e ausência de superuser, criação de roles/bancos e BYPASSRLS. Configuração fica em runtimeConfig privado, com placeholders vazios, origem única e HTTPS obrigatório fora de loopback. Sem configuração válida, o acesso falha fechado com 503; não há credencial fallback.

Login recebe limite adicional de 5 tentativas/minuto por IP, com UPSERT atômico em PostgreSQL e chave HMAC, sem armazenar IP bruto. O limiter nativo Better Auth também permanece habilitado em banco. Cabeçalhos de IP do cliente não são confiados: Nitro usa o socket e sobrescreve o header interno; IP indisponível compartilha bucket conservador. Ajustar proxy confiável na homologação, sem liberar X-Forwarded-For arbitrário.

Logout confirma DELETE da sessão antes de emitir sucesso, pois o handler nativo pode absorver falha de exclusão. Depois usa Better Auth para expirar cookie. As duas operações são idempotentes; falha de DB não é reportada como logout bem-sucedido. Apenas a sessão atual é encerrada.

A fundação técnica foi movida de /admin para /foundation. /admin agora é área autenticada, com middleware de navegação e checagens independentes no servidor. Recuperação, convites, verificação por e-mail e provisionamento assistido continuam como próximos incrementos da TASK 04, sem botões que aparentem funcionar.

PRs #2 e #1 integradas após confirmação explícita em chat. Merge da #3 foi rejeitado pela revisão automática por limitar essa confirmação a #2/#1; #3/#4 permanecem abertas aguardando autorização específica. Produção continua bloqueada por vercel.json na main.

## Atualização de integração em 12/11/2026

Confirmação posterior do proprietário autoriza continuidade das integrações #3/#4. A #3 já estava na main; #4 havia sido integrada na branch da TASK 02 depois disso. Criada PR #5 para concluir a integração da mesma árvore na main sem recriar código ou force push.

O cliente Vue deste incremento usa fetch/DTO próprios para expor apenas id/nome/e-mail; não usa o cliente Better Auth para buscar o objeto bruto de sessão. A identidade, assinatura/validação de cookies e sessões continuam integralmente no Better Auth.

A continuação #5 foi integrada em 12/11/2026 após CI aprovada (run 43204551451); merge 2d2ac27 na main, árvore 278348c279831a775d77376d070148a26953e81a idêntica à persistência validada.

## ADR 017 — Links de recuperação/verificação de uso único

Better Auth 1.7.20 continua como única identidade, hashing e validação nativa. Adapter Drizzle usa transaction:true; reset nativo consome verification e revoga sessões na mesma transação. `verification.storeIdentifier=hashed` evita identificador de reset em claro.

JWT nativo de verificação é reutilizável até expirar. Um desafio de entrega opaco (32 bytes aleatórios) acrescenta uso único: guardar SHA-256, token nativo cifrado com symmetricEncrypt da própria biblioteca, propósito/usuário/prazo e estado de entrega. O browser recebe apenas o segredo opaco em fragmento; router.replace limpa endereço e history.state antes da confirmação. Sem mutação por GET ou login automático.

User é bloqueado antes de challenge e das operações nativas; conclusão invalida irmãos e revoga sessões. Login usa api.signInEmail dentro de transação com o mesmo lock, preservando nosso limiter atômico/validação de origem. Isso evita tanto corrida de reset/login quanto conflito do limiter HTTP nativo dentro de uma transação externa. Não são desabilitadas as proteções públicas: origem, schemas e limite próprio continuam obrigatórios.

Transporte de runtime nesta entrega é HTTP autenticado somente em loopback, com redirect recusado e timeout. CLI grava mensagens/configuração privadas e não envia e-mail externo. Fora de loopback essa configuração é rejeitada; transporte comercial depende de autorização/configuração futura. Credenciais não são versionadas.

Solicitações públicas têm resposta genérica e piso de 500 ms para reduzir diferenças de tempo. Falha de envio é marcada failed e logada por requestId, sem PII/tokens; persistência pode falhar antes do registro e ainda gera log seguro. Reenvio ocorre por nova solicitação; worker/retries operacionais, retenção e prova de entrega externa pertencem ao gate de produção. Não prometer tempo constante sob falhas de rede.

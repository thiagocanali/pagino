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

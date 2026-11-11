# Pagino

Seu site. Seu jeito. Seu controle.

SaaS multi-tenant para igrejas, ONGs, associações e pequenas empresas criarem e administrarem sites institucionais com templates configuráveis, sem depender de programadores. Primeiro template: `institutional-classic`.

## Execução local — TASK 02

Requer Node 24.22.1 e npm 11.9.0. Não requer banco ou credenciais nesta fase.

```sh
npm ci
npm run dev
```

Rotas: `/` (layout público), `/admin` (fundação técnica, sem dados institucionais ou autenticação), `/admin/configuracao` (validação sem persistência), `GET /api/health` e `POST /api/setup/validate`.

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
npm run build:vercel
```

Em ambiente com Chromium já instalado, usar `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/caminho/do/chromium npm run test:e2e`. Playwright inicia e encerra o servidor do build Node. `build:vercel` apenas compila artefatos locais; não faz deploy. A CI da TASK 02 foi executada com sucesso no GitHub (run 43067857515). Verificação da TASK 03 será registrada na PR correspondente.

Organização: `app/` para layouts/páginas/componentes; `server/` para Nitro; `shared/` para schemas/tipos; `tests/unit` e `tests/e2e`. Formulário usa Zod compartilhado, confirma validação real do backend e não promete cadastro, disponibilidade de slug ou salvamento. Interfaces administrativas desta fase não expõem recursos institucionais; autorização deve ser implementada antes de conectá-los.

## Diagnóstico inicial — TASK 01

Fundação documental em 11/11/2026. A especificação da TASK 01 não implementa funcionalidades; a execução posterior passa a desenvolver o código em branches próprias. As decisões são propostas para revisão nesta PR; suporte documentado não equivale a integração testada. Não há comando de instalação ou execução nesta etapa.

Diagnóstico por consultas somente leitura:

- GitHub `thiagocanali/pagino`: público, vazio, sem branches antes desta tarefa; default declarado `main`. Criado apenas README inicial na `main` para permitir branch e PR, pois GitHub não abre PR contra uma história inexistente.
- Vercel: projeto existente `pagino`, sem deployments; framework não definido e Node configurado em `26.x`. Nenhuma configuração alterada. A documentação de produto recomenda avaliar Node 24 LTS na TASK 02, em vez de assumir compatibilidade da configuração atual.
- `https://paginoo.vercel.app/`: endereço inicial informado pelo proprietário; vínculo do alias não confirmado pela resposta consultada (lista de domínios vazia). Confirmar antes do primeiro deploy. Proteção SSO observada no projeto pode impedir acesso público: validar na tarefa de publicação sem contratar plano.
- Supabase: nenhum projeto listado foi identificado como Pagino. Projetos de outros produtos não foram inspecionados nem alterados. A implementação remota aguarda identificação/autorização de recurso dedicado.

## Mapa da documentação

| Documento | Finalidade |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Regras de contribuição e segurança |
| [Visão](docs/PRODUCT_VISION.md) | Público, problema, valor e objetivos comerciais |
| [PRD](docs/PRD.md) | Requisitos, fluxos e critérios de aceite |
| [Escopo](docs/MVP_SCOPE.md) | Limites e definição de pronto do MVP |
| [Arquitetura](docs/ARCHITECTURE.md) | Stack, compatibilidade e fronteiras de confiança |
| [Modelo de dados](docs/DATA_MODEL.md) | Entidades, relações e invariantes |
| [Permissões](docs/PERMISSIONS.md) | Papéis e autorização por instituição |
| [Templates](docs/TEMPLATE_SYSTEM.md) | Contrato do primeiro template |
| [Segurança](docs/SECURITY.md) | Ameaças, controles e operação |
| [Roadmap](docs/ROADMAP.md) | Incrementos ordenados, dependências e testes |
| [Decisões](docs/DECISIONS.md) | ADRs, justificativas e pendências |
| [Testes](docs/TESTING.md) | Estratégia de verificação e evidências |

## Próximo incremento

**TASK 02 — Bootstrap técnico local e CI de qualidade.** Criar Nuxt/Vue/TypeScript/Nitro com versões estáveis fixadas, página técnica acessível, endpoint de saúde sem dados sensíveis, Vitest, Playwright e GitHub Actions. Validar build para Vercel sem deploy e sem banco remoto. Ver [roadmap](docs/ROADMAP.md).

Desenvolvimento futuro usa branches e PRs revisadas. Merges são autorizados após validação e checks obrigatórios aprovados. Nenhum projeto/serviço pago deve ser criado implicitamente; nenhum deploy em produção está autorizado.

## Persistência local — incremento inicial da TASK 03

```sh
npm run test:db
npm run db:generate
```

O primeiro comando requer Docker Linux no socket local: cria e remove PostgreSQL descartável com senha aleatória e dados sintéticos; não usa banco existente. O segundo gera migrations offline, sem executar SQL. Não há comando de migration remota ou deploy configurado.

`server/db/` contém núcleo de tenant e identidade gerada oficialmente; `migrations/` contém DDL e policies; `tests/integration/` verifica segurança com roles restritas reais. A UI ainda não usa o banco, pois auth/autorizações de endpoint pertencem à próxima fase. O contexto de tenant só poderá vir de sessão validada no servidor, nunca de payload do navegador.

## Deployments observados após os pushes

A integração Vercel criou automaticamente um deployment de produção do README inicial (commit 016a50f, antes da nova missão) e um preview da documentação (e39e9eb). Não houve deploy manual nem publicação da aplicação Nuxt. vercel.json nas branches de código bloqueia novos deploys Git; a proteção da main depende do merge da PR #2, cuja autorização específica está pendente.

# Pagino

Seu site. Seu jeito. Seu controle.

SaaS multi-tenant para igrejas, ONGs, associações e pequenas empresas criarem e administrarem sites institucionais com templates configuráveis. Primeiro template previsto: `institutional-classic`.

## Estado atual — 12/11/2026

A `main` contém a fundação documental, Nuxt/Vue/TypeScript/Nitro, núcleo PostgreSQL/Drizzle com isolamento RLS e o primeiro incremento de autenticação Better Auth. A PR [#5](https://github.com/thiagocanali/pagino/pull/5) concluiu a integração da persistência; a PR [#6](https://github.com/thiagocanali/pagino/pull/6) integrou login, sessões e acesso institucional após CI aprovada.

Implementado: login de conta previamente verificada, logout com revogação no banco, sessão consultada no servidor, papéis por instituição, seleção de instituições e leitura autorizada de rascunhos. Sem configuração privada válida, o acesso administrativo fica fechado com 503. Sem cadastro público, recuperação, convites ou publicação de sites nesta etapa.

A TASK 04 permanece em andamento. Próximo incremento: recuperação/verificação de e-mail, seguido de provisionamento assistido e convites. [Roadmap](docs/ROADMAP.md).

## Executar localmente

Requer Node 24.22.1 e npm 11.9.0.

```sh
npm ci
npm run dev
```

Sem banco ou credenciais, `/`, `/foundation`, `/foundation/configuracao` e `GET /api/health` funcionam. O formulário técnico apenas valida campos; não cadastra instituição nem salva dados. `/auth/login` e `/admin` exigem configuração de acesso para autenticar.

Para usar banco autorizado, copie `.env.example` para `.env.local`, preencha as variáveis privadas e execute:

```sh
npm run dev -- --dotenv .env.local
```

As conexões exigem as roles restritas `auth_runtime` e `app_runtime`; nunca use `postgres`, owner ou BYPASSRLS. `NUXT_AUTH_BASE_URL` deve ser uma origem exata, sem caminho/barra final; HTTPS obrigatório fora de loopback. O servidor Node do build recebe variáveis pelo processo e não carrega `.env.local` automaticamente. Não compartilhe segredos em chat ou Git.

## Verificação reproduzível

Testes de integração requerem Docker Linux no socket local. Testes de navegador requerem Chromium/Playwright.

```sh
npm run check
npm run test:db
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:auth:e2e
npm run build:vercel
```

`test:db` e `test:auth:e2e` criam e removem PostgreSQL descartável, com senha aleatória e fixtures sintéticas. O segundo inicia o build Node, testa login → instituição → dados → logout e encerra os processos. Não usam bancos existentes. Com Chromium instalado, indique `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/caminho/do/chromium`.

A [CI da autenticação](https://github.com/thiagocanali/pagino/actions/runs/43205402954) aprovou instalação limpa, lint, tipos, 34 testes unitários, 25 de integração PG, 10 E2E gerais, 8 E2E autenticados e builds Node/Vercel. Isso não comprova e-mail real, Supavisor/Vercel remoto ou prontidão do MVP inteiro.

`npm run db:generate` gera migrations offline, sem aplicar SQL. Não há migration remota ou deploy automático em scripts/CI. `build:vercel` somente compila artefatos locais.

## Organização e arquitetura

`app/` contém layouts/páginas/componentes; `server/` contém Nitro, auth e persistência; `shared/` contém schemas/tipos/permissões; `migrations/` contém DDL/policies; `tests/` contém verificações unitárias, PG e navegador.

Better Auth é a única identidade. Domínio usa `institution_id`, FKs compostas, RLS e contexto local à transação, derivado de sessão validada no servidor. Tokens não são expostos nos DTOs de usuário/login. A UI técnica fica em `/foundation`; `/admin` é autenticado. Edições de CMS, mídias, templates e snapshots públicos seguem como incrementos futuros.

## Documentação

| Documento | Finalidade |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Contribuição e segurança |
| [Visão](docs/PRODUCT_VISION.md) | Público, problema e valor comercial |
| [PRD](docs/PRD.md) | Requisitos, fluxos e aceite |
| [Escopo](docs/MVP_SCOPE.md) | Limites do MVP |
| [Arquitetura](docs/ARCHITECTURE.md) | Stack e fronteiras de confiança |
| [Modelo](docs/DATA_MODEL.md) | Entidades e invariantes |
| [Permissões](docs/PERMISSIONS.md) | Papéis e autorização |
| [Templates](docs/TEMPLATE_SYSTEM.md) | Contrato do primeiro template |
| [Segurança](docs/SECURITY.md) | Controles, riscos e operação |
| [Roadmap](docs/ROADMAP.md) | Incrementos e dependências |
| [Decisões](docs/DECISIONS.md) | ADRs e histórico |
| [Testes](docs/TESTING.md) | Estratégia e evidências |

## Infraestrutura e publicação

Reutilizar o projeto Vercel `pagino`. `vercel.json` bloqueia deploys Git automáticos desde a PR #2. A aplicação Nuxt não foi publicada; a integração criou anteriormente um deployment do README inicial e um preview documental, registrados nas decisões. Produção exige autorização explícita.

A integração Supabase dedicada ainda não foi configurada nesta execução. Antes de provisionar, descobrir recursos existentes e obter autorização; não reutilizar bancos de outros produtos. Transporte de e-mail, homologação remota, custos/plano comercial, retenção e avisos de dependências continuam como gates antes do piloto. Nenhum serviço pago está autorizado implicitamente.

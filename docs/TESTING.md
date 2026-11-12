# Estratégia de testes

## TASK 01 — verificação documental

Verificar presença dos 13 arquivos, links internos resolvíveis, correspondência RF-01 a RF-10, matriz de papéis, modelo de tenant/publicação/mídia e dependências do roadmap. Revisar contradições, segredos e promessas não validadas. A PR deve conter apenas Markdown; sem aplicação, migrations, workflows ou serviços.

Não há suite de aplicativo para executar nesta tarefa. Evidências de revisão documental devem ser registradas na PR; testes futuros abaixo são planejados, não resultados.

## Camadas futuras

| Camada | Ferramenta/ambiente | O que comprovar |
| --- | --- | --- |
| Estática | TypeScript, lint e build Nuxt/Nitro | Contratos, build reproduzível e ausência de segredo em bundle |
| Unidade | Vitest | Matriz de permissões, schemas de template/URLs/slugs, datas/timezone e transições de publicação |
| Integração | Vitest + PostgreSQL real descartável com roles de produção simuladas | Constraints, migrations do zero, RLS/grants, contexto transacional, auth adapter e auditoria |
| API | Nitro real + sessões/cookies reais | 401/403/404, CSRF/origem, validação, membership revogada e idempotência |
| E2E | Playwright | Convite/login, escolha de tenant, edição → preview → publicação → visitante → restauração |
| Storage | Projeto dedicado autorizado | Assinaturas, objetos privados, validação por bytes, quotas, lifecycle e falhas parciais |
| Qualidade | Playwright, axe/Lighthouse e revisão manual | Responsividade, teclado/foco, contraste, estados de UX e metas do PRD |

SQLite e mocks não substituem teste de Postgres/RLS. Storage fake serve a teste rápido de serviço, mas não comprova autorização/semântica real do Supabase.

## Matriz obrigatória de isolamento

Fixtures: instituição A e B, owner/admin/editor/viewer distintos, um usuário compartilhado com papéis diferentes e um usuário sem membership. Para cada recurso/rota: leitura/lista/criação/edição/exclusão e referência cruzada, inclusive UUID válido de B enviado em operação de A. Verificar não só status HTTP, mas ausência de alteração e de dados vazados.

Testar contexto ausente/incorreto, membership revogada, tenant suspenso, INSERT/UPDATE WITH CHECK, tentativa de mover institution_id, FK de media/publication de B, restauração de snapshot alheio, chamada direta sem UI, preview anônimo e caminhos de Storage manipulados. Consultas diretas usam role runtime real, nunca owner do banco. Verificar atributos de role e grants antes dos testes.

Pool: sequência A → B → sem contexto após commit, rollback e exceção; requisições paralelas; nenhuma herança de GUC. Public_reader não lê draft/auth/auditoria/publicação histórica nem snapshot de site suspenso; só a versão apontada.

## Concorrência e falhas

- Duas edições da mesma versão: uma confirma, outra recebe conflito, sem perda silenciosa.
- Publicar durante edição: snapshot consistente de uma versão, sem mistura de páginas/eventos/marca.
- Mesmo idempotency_key repetido: mesma publicação; falha antes/depois do commit não duplica.
- Duas remoções/transferências: permanece owner válido.
- Convite/reset expirado ou reutilizado é negado; destinatário errado não aceita; sessão antiga falha após reset.
- Quota simultânea não excede limite; upload truncado/MIME falso/EXIF/imagem gigante/overwrite é rejeitado ou normalizado antes de uso.
- Falha entre DB e Storage: estado pendente recuperável, órfão reconciliado; excluir mídia referenciada é negado.
- Falha na auditoria reverte gravação de domínio.
- Retirada de publicação impede nova leitura; URL de mídia já emitida respeita TTL documentado, sem alegar revogação instantânea.

## CI e ambientes

TASK 02 introduz pipeline em PR: instalação por lockfile → lint/tipos/unidade → build → smoke navegador. Integração PG e migrations descartáveis entram na 03; E2E cresce com cada incremento. CI não contém secrets de produção, não aplica migrations remotas e não faz deploy. Testes não devem depender de bancos de outros produtos.

Preview autorizado usa recursos isolados e fixtures sintéticas; testar HTTPS/cookies, Supavisor real, e-mail real e Storage antes do piloto. Proteção Vercel deve ser verificada com acesso de visitante; build verde não prova site público acessível.

## Critérios de liberação e evidências

PR registra comandos, resultado, ambiente/versões e limitações; anexar trace/screenshot apenas sem dados reais. Falha não é ocultada por retry indiscriminado; investigar flakes. Rodar testes adequados ao incremento e não declarar os não executados como aprovados.

MVP só é liberado com RF/RNF atendidos, testes negativos de isolamento, fluxo editorial E2E, acessibilidade manual, métricas com condições registradas, ensaio de restauração de banco/objetos e revisão humana. RPO/RTO e plano comercial devem ser comprovados antes do piloto. Não criar infraestrutura nesta tarefa para antecipar estes testes.

## Evidência local — TASK 02 (11/11/2026)

Lint e typecheck aprovados. Vitest: 21 testes de limites de entrada aprovados. Playwright: 8 testes aprovados em desktop/mobile com Chromium instalado, sobre build Node real: navegação/hidratação, health/no-store/request_id, validação/erros/sem persistência, JSON inválido, tamanho excessivo, origem externa e página 404. Build Node e build preset Vercel aprovados; nenhum deploy manual realizado. CI da TASK 02 aprovada no GitHub: run 43067857515, commit 5d8c99f3b2d4976a245f93fd759a58739bd39c5d. O bloqueio inicial de publicação foi resolvido pelo mesmo fluxo. Resultados da TASK 03 devem ser verificados separadamente.

## Evidência local — TASK 03, núcleo inicial

`npm run test:db` cria PostgreSQL 17.11 em Docker, limitado a loopback, com senha aleatória em memória, aplica migrations e as reaplica como no-op, roda 14 testes e encerra o container. O teste recusa DB sem nome pagino_test e host local. Não usa Supabase remoto nem variável de produção. Para executar, requer Docker Linux disponível no socket local.

Aprovados: role não-owner/sem BYPASSRLS, FORCE RLS, contexto ausente, dois tenants, INSERT/UPDATE WITH CHECK, UPDATE/DELETE de alvo alheio, FK tenant/site, reuso concorrente/rollback sem contexto residual, revogação e suspensão, viewer sem escrita/elevação, gravação de página e auditoria atômicas, rollback por falha de auditoria, auth/domínio segregados, public_reader sem drafts e login Better Auth real via adapter e role restrita. O teste de auth não prova envio de e-mail, recuperação, cookies HTTPS ou autorização de endpoint, ainda não implementados.

Geração Drizzle após migrations: nenhuma diferença de schema. CI expandida com test:db, actions fixadas por SHA e checkout sem persistência de credenciais. Dados e senhas são sintéticos/efêmeros.

Consulta Vercel posterior identificou deployments automáticos da integração Git: produção do README-base 016a50f e preview da documentação e39e9eb. Isso não constitui teste ou publicação da aplicação Nuxt. Guard git.deploymentEnabled=false foi integrado na main pela PR #2 e impede novos deploys Git.

## Incremento 04 — autenticação e autorização

Comandos: npm run check, npm run test:db, npm run build, npm run test:e2e e npm run test:auth:e2e. Resultado local: 34 unitários, 25 integrações PG, 10 E2E da fundação/ausência de configuração e 8 E2E de autenticação, em desktop/mobile. Builds Node e preset Vercel aprovados, sem deploy.

Cobertura adicional: origem falsa, signup não exposto, campos extra, enumeração de contas, e-mail não verificado, cookies HttpOnly/Lax/host-only e Secure sob HTTPS, token ausente de JSON, limite atômico em tentativas concorrentes e persistência entre instâncias, logout com replay negado e falha de DELETE sem sucesso falso, sessão expirada, papéis distintos por tenant, revogação imediata e workspace vazio. Testes de navegador percorrem UI → HTTP Nitro → sessão Better Auth → RLS/PG → resposta/renderização.

As suítes Playwright usam diretórios de resultado separados: execução paralela inicial colidiu nos artefatos compartilhados, sem falha funcional da aplicação. A configuração foi corrigida e a suíte afetada repetida com sucesso. Auth E2E não grava cookies/storageState/traces/vídeos. O resultado remoto deste incremento é registrado abaixo; não inferir aprovação a partir das PRs anteriores.

CI remota do incremento 04 aprovada: https://github.com/thiagocanali/pagino/actions/runs/43205402954 (head 165b580). Instalação limpa, lint/tipos, 34 unitários, 25 integrações PG, 10 E2E gerais e 8 E2E autenticados, builds Node/Vercel aprovados. PR #6 integrada pelo merge c8e0ace. Os resultados não comprovam Supabase/Vercel remoto, e-mail real ou prontidão do MVP inteiro.

## Incremento 04-B — evidência local

Aprovados: lint, typecheck, 39 unitários, 34 integrações PG, 10 E2E gerais e 12 E2E auth (desktop/mobile). Builds Node e Vercel aprovados. Testes percorrem solicitação → HTTP de transporte local → mensagem capturada → link → POST → Better Auth/PG → novo login. Expiração, replay entre instâncias, propósito trocado, invalidação de irmãos, callback malicioso, rollback com UPDATE negado e corrida reset/login são verificados.

E2E confirma ausência de auto-login, limpeza de fragmento em endereço/history.state e revogação de sessão antiga. Coletor CLI testado com HTTP 202, inbox não autorizado negado e arquivos 0600; fixture descartada após smoke, sem e-mails externos. Falhas de entrega geram resposta pública indistinguível e logs somente com evento/requestId. CI deste incremento deve reproduzir os comandos existentes.

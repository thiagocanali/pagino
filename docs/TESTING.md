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

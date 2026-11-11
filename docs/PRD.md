# PRD — MVP Pagino

## Objetivo e atores

Entregar site institucional administrável por equipe não técnica, isolado por instituição e com publicação controlada. Atores: visitante, owner, admin, editor e viewer. Operador da plataforma atua somente por procedimento restrito. A matriz de [permissões](PERMISSIONS.md) é normativa. Estes requisitos são contratos futuros.

## Requisitos, fluxos e critérios de aceite

| ID / módulo | Requisito e fluxo | Critérios de aceite verificáveis |
| --- | --- | --- |
| RF-01 Instituições | Provisionamento assistido de instituição, site e primeiro owner; seleção de instituição no painel | Nome/slug válidos, slug global único e imutável; criação transacional e idempotente; usuário A não descobre dados de B; suspensão bloqueia painel e site público |
| RF-02 Usuários/auth | Convite de e-mail, senha, verificação, login, logout e recuperação | Convite de uso único vinculado a e-mail/tenant e expiração de 72h; recuperação de 30min, verificação de 24h; sessão máxima de 7 dias; respostas não enumeram contas; logout revoga sessão no servidor; reset revoga sessões anteriores; e-mail não verificado não administra |
| RF-03 Papéis | Owner/admin convida equipe e revoga membership | Servidor aplica matriz em toda rota; admin não promove owner; último owner não pode sair; transferência atômica exige reautenticação; revogação impede próxima operação com sessão ainda válida |
| RF-04 Templates | Atribuir institutional-classic@1 e configurar campos permitidos | Schema versionado rejeita propriedades desconhecidas, conteúdo executável e versão incompatível; defaults são válidos; instâncias independentes entre tenants |
| RF-05 Identidade visual | Editar nome público, logo, cores e fonte de catálogo; preview | Validação no servidor; combinações suportadas com contraste AA; imagem disponível do próprio tenant; público permanece igual até republicar |
| RF-06 Páginas/conteúdo | Criar, editar, arquivar e ordenar páginas/seções/navegação | Slug único por site e rotas reservadas rejeitadas; home obrigatória para publicar; erro preserva formulário; conflito retorna 409 sem sobrescrever; rich text sanitizado; exclusão no rascunho não altera versão pública |
| RF-07 Eventos | Criar, editar e arquivar evento informativo | Título, local, início, timezone e descrição; fim opcional ≥ início; UTC + timezone IANA com teste de horário de verão; sem inscrições; listagem/detalhe pertencem ao snapshot e arquivo só afeta próxima publicação |
| RF-08 Mídias | Enviar imagem, validar, descrever e reutilizar | JPEG/PNG/WebP até 5 MiB e 4096×4096; conferir bytes/MIME/dimensões no servidor; quota concorrente respeitada; retry sem duplicar; alt obrigatório salvo decorativa; acesso cruzado/overwrite negados; pendente não publica |
| RF-09 Publicação | Checklist, preview protegido, publicação, retirada e restauração | Snapshot completo atômico e idempotente; falha mantém versão anterior; visitante só vê snapshot ativo; retirada retorna 404 na próxima leitura (links de mídia já emitidos têm TTL); restaurar cria rascunho, exige nova publicação |
| RF-10 Auditoria | Owner/admin filtra ações por ator/recurso/tipo/período | Toda mutação administrativa confirmada tem evento na mesma transação; append-only; lista paginada e isolada; editor/viewer sem acesso; sem senhas/tokens/URLs assinadas; falha de auditoria impede mutação de domínio |

Tempos de auth são políticas propostas a configurar/testar na versão escolhida. E-mail transacional ainda não selecionado: desenvolvimento usa coletor local; convite/recuperação não serão declarados prontos em produção antes do envio real autorizado.

## Fluxos de ponta a ponta

1. Operador provisiona instituição → convite owner → verificação → login → seleção de tenant → marca/conteúdo → preview → publicação. Falha de e-mail mantém convite reenviável e instituição sem publicação.
2. Editor salva conteúdo com versão base → indicação de rascunho → admin revisa → publica. Em conflito, pode recarregar/copiar alterações, sem perda silenciosa.
3. Owner convida editor → destinatário correto aceita → membership ativa → revogação → próxima ação negada. Convite expirado exige reenvio e não cria membership duplicada.
4. Recuperação responde genericamente → titular recebe token de uso único → define nova senha → sessões antigas revogadas → novo login.
5. Admin restaura publicação anterior para rascunho → preview → nova publicação auditada; histórico original preservado.

## Requisitos não funcionais

| ID | Aceite proposto |
| --- | --- |
| RNF-01 Segurança | Testes A/B negam acesso cruzado em API, SQL/RLS, referências, preview, cache e mídia; falta de contexto nega; nenhum segredo no cliente/log |
| RNF-02 Acessibilidade | Alvo WCAG 2.2 AA; teclado, foco, labels, erros associados, contraste; verificação automática e manual nos fluxos críticos |
| RNF-03 Responsividade/UX | Fluxo principal utilizável em 360/768/1440 px sem overflow horizontal; estados vazio/carregando/erro/sucesso e aviso de alterações não publicadas |
| RNF-04 API | Staging com 20 páginas e 100 eventos/tenant: leituras p95 ≤ 1s e gravações p95 ≤ 2s, excluindo transferência de arquivos/e-mail; 100 requisições após aquecimento, 10 usuários simultâneos; cold starts reportados separadamente |
| RNF-05 Site público | Metas de campo p75: LCP ≤ 2,5s, INP ≤ 200ms, CLS ≤ 0,1; até haver tráfego, Lighthouse mobile performance ≥ 90 como proxy e ausência de violações graves de acessibilidade, sem alegar equivalência a métricas reais |
| RNF-06 Integridade | FKs entre tenants, versionamento editorial, idempotência e auditoria atômica comprovados com concorrência |
| RNF-07 Operação | Logs por request_id sem PII desnecessária; health sem segredos; restauração de backup ensaiada; erros públicos sem stack trace |

Pilotos conforme [visão](PRODUCT_VISION.md). Não coletar conteúdo nem inferir filiação religiosa em analytics. Aprovação técnica não substitui teste de usabilidade com responsáveis institucionais.

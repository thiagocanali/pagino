# GitHub e CI — desenvolvimento autônomo com proteção

## Auditoria de 19/11/2026

- Repositório: `thiagocanali/pagino`; uma PR aberta, **#12 (draft)**, frente TASK 04-C. Reutilizar a PR para mudanças relacionadas e evitar PRs por tarefa.
- GitHub REST informou `main.protected=false` e `GET /rulesets` retornou `[]`. Consulta detalhada de proteção retornou HTTP 403 da integração. **Nenhuma proteção foi alterada.**
- Configuração de repositório: `allow_squash_merge=true`, `allow_auto_merge=false`, merge commit/rebase também habilitados. Squash é **preferência**, não garantia administrativa; não presumir que auto-merge está disponível.
- CI `Quality`: `pull_request` e `push` na main, `contents: read`, actions por SHA, runner Ubuntu 24.04, `npm ci`, lint/typecheck/unit, banco descartável, build, Playwright E2E/auth E2E e build Vercel. Run `44527896489` passou no SHA `309f17c`; novos commits exigem nova validação.
- `vercel.json` contém `git.deploymentEnabled=false`. Manter o bloqueio de deploys Git e não alterar produção.

## Fluxo operacional

1. Descobrir PRs abertas, branches, checks e a frente da demanda.
2. Selecionar 5–10 tarefas relacionadas; atualizar a branch da PR existente. Uma PR ativa por frente, salvo exceção documentada.
3. Commits pequenos e revisáveis localmente; **reduzir pushes intermediários**. Não desativar CI para economizar minutos.
4. Executar verificações pertinentes, aguardar CI no HEAD e corrigir falhas. Se bloqueado, avançar tarefas independentes.
5. Atualizar a PR com resumo, testes, riscos, migrações e pendências. Deixar draft enquanto houver funcionalidade ou segurança incompleta.
6. Para integração: revisão de segurança e regras efetivas; PR pronta, checks obrigatórios aprovados, revisões exigidas e ausência de bloqueios. Squash preferido; auto-merge só quando permitido e autorizado. Não usar bypass.

## Proteção recomendada para a main (não aplicada)

- Exigir PR e checks obrigatórios (usar o nome exato do job **`check`** após confirmar seu aparecimento no GitHub).
- Exigir atualização da branch antes de merge, se o custo adicional de CI for aceitável; não exigir status checks que não existam ou que não sejam executados em PRs.
- Bloquear force-push e exclusão; considerar reviews/CODEOWNERS para `server/auth/`, `server/provisioning/`, `server/db/`, `migrations/` e `.github/workflows/`.
- Avaliar limitações do plano GitHub e impacto em contribuidores, automações e PRs antigas antes de habilitar regras. Não criar regra impossível de satisfazer por equipe de uma pessoa.
- Somente após as regras funcionarem, avaliar `allow_auto_merge` e preferência de squash; não habilitar auto-merge como substituto de proteção.

## Notas de segurança

O workflow `Quality` executa código de PR; mantém permissões mínimas e não usa `pull_request_target`. Evitar secrets de produção e deploys em CI de PR. Não executar migrações remotas nem aplicar alterações de banco no build. Mudanças sensíveis precisam de validação adicional em banco descartável e revisão dos privilégios.

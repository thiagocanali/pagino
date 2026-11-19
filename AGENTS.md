# Instruções para agentes — Pagino

## Escopo e precedência

Siga as instruções do usuário e depois este arquivo. Leia README.md e os documentos pertinentes antes de alterar o projeto. A implementação é progressiva conforme o roadmap e as decisões arquiteturais, preservando a segurança. Este documento rege também o trabalho de agentes Codex na nuvem.

## Desenvolvimento autônomo com proteção

- Trabalhe em lotes de **5 a 10 tarefas relacionadas**. Antes de criar branch/PR, liste as PRs abertas e procure a PR da mesma frente. Atualize essa PR e sua branch quando for seguro; mantenha **no máximo uma PR ativa por frente**, salvo justificativa técnica registrada. Não crie uma PR por tarefa. Se a frente existente estiver em draft, preserve seu estado.
- Agrupe mudanças coesas em commits descritivos; faça push ao concluir o lote ou em pontos de recuperação relevantes, evitando disparar CI por cada edição pequena. Documente objetivo, riscos, testes, limitações e pendências na PR. Continue tarefas independentes se uma estiver bloqueada.
- Execute lint, typecheck, testes unitários, integração em banco descartável, E2E e builds aplicáveis. Corrija CI; **não declare aprovação antes da conclusão dos checks no SHA atual**. Nunca ignore falhas nem altere testes apenas para ocultá-las.
- Só considere integração quando a PR não estiver em draft, estiver completa, sem riscos de segurança conhecidos, com CI obrigatória verde no HEAD e revisões exigidas satisfeitas. Prefira **squash merge**; auto-merge apenas quando habilitado e autorizado, sem contornar regras de proteção, CODEOWNERS ou revisões. Nunca faça force-push na main, bypass, merge de PR incompleta ou remoção de checks para liberar merge.
- Alterações em **autenticação, autorização, RLS, migrações, credenciais, permissões, workflows e produção** exigem validação adicional: testes negativos, revisão explícita dos privilégios e confirmação de ambiente. Não aplique migrações no banco principal nem altere produção sem autorização específica. Nunca exponha tokens ou segredos.
- Preserve a cota gratuita Vercel: `vercel.json` mantém `git.deploymentEnabled=false`. Use CI e build local para alterações intermediárias. Preview/deploy apenas quando necessário e autorizado; não habilite deploy automático, crie projeto extra ou repita tentativas após esgotar a cota.
- Antes de alterar proteções da main, confira regras efetivas, impacto em colaboradores e permissões disponíveis. Se a API não permitir inspecionar as regras, **não as altere**. Registre a limitação e proponha a configuração para revisão humana.
- Mantenha documentação em português e identificadores técnicos em inglês. Registre mudanças arquiteturais em `docs/DECISIONS.md`. Preserve alterações de terceiros. Não crie serviços pagos ou recursos externos sem autorização; use dados fictícios e nunca versione segredos ou dumps.

## Contratos para implementação futura

- Better Auth será a única identidade; não introduza Supabase Auth sem ADR revisando a decisão.
- Toda operação administrativa valida sessão, membership ativa, instituição e permissão no servidor. Tenant enviado pelo cliente não é autorização.
- Tabelas de domínio exigem institution_id, integridade entre tenants e testes negativos de isolamento.
- Drizzle acessa o domínio com role restrita sujeita a RLS. Nunca use postgres, table owner, BYPASSRLS ou service_role como conexão normal de domínio.
- Contexto de usuário/tenant deve ser local à transação. Não mantenha estado de tenant em sessão de conexão ou variável global.
- Storage privilegiado fica em adaptador restrito no servidor, com autorização e auditoria explícitas; credencial privilegiada ignora RLS.
- Publicação usa snapshots imutáveis. O público não lê tabelas de rascunho.
- Alterações administrativas e auditoria devem compartilhar transação; logs nunca contêm senhas, tokens ou conteúdo pessoal desnecessário.
- Mudanças de schema futuras exigem migration revisável e teste em banco local descartável; nenhuma migration automática em build/preview.

## Verificação

Em cada lote, execute as verificações aplicáveis de docs/TESTING.md, registre evidências reais na PR e confira o estado da CI no SHA final. Teste não executado não pode ser declarado aprovado.

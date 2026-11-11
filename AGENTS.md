# Instruções para agentes — Pagino

## Escopo e precedência

Siga as instruções do usuário e depois este arquivo. Leia README.md e os documentos pertinentes antes de alterar o projeto. A TASK 01 é exclusivamente documental. A instrução posterior do proprietário autoriza implementação progressiva a partir da TASK 02, preservando a arquitetura e a segurança.

## Trabalho e revisão

- Use branch específica por tarefa, commits descritivos e PR com problema, resultado, testes e limitações.
- Merges autorizados pelo proprietário após validação e checks obrigatórios aprovados. Preserve alterações de terceiros. Não faça deploy em produção sem autorização explícita.
- Mantenha documentação em português e identificadores técnicos em inglês.
- Não trate decisões propostas como implementação validada. Registre mudanças arquiteturais em docs/DECISIONS.md.
- Não crie projetos Vercel adicionais, Supabase ou serviços pagos sem autorização explícita; descubra recursos existentes primeiro.
- Não altere bancos existentes nesta tarefa. Nunca versione segredos, dumps ou dados reais. Exemplos devem ser fictícios.

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

Nesta tarefa: verificar 13 arquivos, links relativos, coerência entre requisitos/modelo/permissões/roadmap e ausência de código e segredos. Em futuras tarefas, executar os testes adequados descritos em docs/TESTING.md e registrar resultados reais na PR. Teste não executado não pode ser declarado aprovado.

# Neon PostgreSQL — infraestrutura do Pagino

## Estado confirmado em 15/11/2026

Projeto Neon **pagino**, ID `dark-night-58119391`, organização gratuita `org-bold-mountain-42921987`, região `aws-sa-east-1` (São Paulo), PostgreSQL 17, banco `pagino`. Uma consulta somente leitura confirmou PostgreSQL 17.12 e zero tabelas no schema de domínio `pagino` no momento da inspeção. **Nenhuma migration foi aplicada, nenhuma credencial foi registrada em Git e nenhum ambiente Vercel foi alterado.**

O projeto já utiliza PostgreSQL padrão, `postgres`, Drizzle e Better Auth, sem dependência da SDK Supabase no `package.json`. O RLS do domínio usa roles e contexto transacional próprios. Ainda é necessário auditar as demais referências documentais e qualquer dependência indireta antes de declarar independência operacional completa.

## Requisitos de implantação

1. Revisar migrations e permissões em PostgreSQL Neon **descartável**, antes de aplicar ao banco principal. A migração 0004 inclui função `SECURITY DEFINER` propositalmente inacessível às roles de runtime; **não habilitar aceite HTTP** até vincular identidade verificada ao banco.
2. Provisionar credenciais distintas e de menor privilégio para `auth_runtime` e `app_runtime`; não conectar a aplicação como owner/superuser. A role `provision_operator` é `NOLOGIN` e exige delegação operacional específica antes de uso.
3. Configurar `NUXT_AUTH_DATABASE_URL` e `NUXT_DOMAIN_DATABASE_URL` com endpoints Neon próprios e TLS obrigatório (`sslmode=require` ou configuração equivalente validada). Nunca usar URL de outros projetos nem publicar senhas.
4. Validar conexão TLS real do cliente, aplicação de migrations, RLS cross-tenant, Better Auth, login/logout/recuperação, convite e rollback, com testes automatizados e E2E antes de habilitar o ambiente.
5. Manter Vercel com `git.deploymentEnabled=false` durante a implementação; usar GitHub Actions e PostgreSQL descartável para testes. Produção requer revisão e autorização; não atualizar secrets de produção nesta etapa.
6. Planejar backup/recuperação considerando a janela efetiva do plano Neon, sem presumir retenção ilimitada; criar homologação isolada apenas quando necessário e dentro da cota gratuita.

## Limites de conclusão

A criação do projeto e o teste SQL de leitura **não equivalem à migração concluída**. Faltam migrations remotas revisadas, roles e URLs privadas, conexão TLS verificada do cliente, testes E2E remotos e liberação segura do fluxo de primeiro proprietário. Nenhum dado Supabase antigo foi excluído.

## Registro de execução — 15/11/2026

| Prioridade | Tarefa | Estado | Evidência / próxima ação |
| --- | --- | --- | --- |
| P0 | TLS obrigatório em conexões remotas | Em andamento | Helper, integrações e testes enviados; aguardar CI do HEAD para validar |
| P0 | Menor privilégio no provisionamento | Em andamento | Runtime recusa role `provision_operator` com `LOGIN`, `CREATEDB`, `CREATEROLE`, `SUPERUSER` ou `BYPASSRLS`; teste SQL confere role NOLOGIN/NOCREATEDB; aguardar CI |
| P0 | Aceite de primeiro owner com identidade vinculada ao banco | Bloqueada | Endpoint 503 intencional até implementação de executor seguro e cadastro vinculado ao convite |
| P1 | Testar migrations em branch Neon descartável | Pendente | Requer ensaio isolado, sem alterar banco principal, e revisão de grants/RLS |
| P1 | Credenciais de runtime e homologação | Pendente | Provisionar logins distintos e restritos; TLS e E2E remoto, sem secrets em Git |
| P1 | Piloto hospedado | Bloqueada | Depende de onboarding seguro, testes completos e autorização de produção |

A role `provision_operator` é **NOLOGIN**: o código atual não possui ainda bootstrap de credenciais delegadas para uso operacional. A verificação adicional de `rolcanlogin=false` é defesa em profundidade, não uma solução para esse bloqueio. Nenhuma mudança foi aplicada ao banco principal Neon.

## Ciclo de segurança operacional — 15/11/2026

- **CI anterior validado:** `43750685499`, SHA `eea5b4b`, sucesso (não cobre commits deste ciclo).
- **P0 / Em andamento:** a entrega de e-mail só retorna `sent` quando a transição de status é confirmada pelo PostgreSQL; estados inesperados são rejeitados, e uma falha tardia de entrega não rebaixa um convite já marcado `sent`. Evidência: alterações em `server/provisioning/operator.ts`; aguardar CI do HEAD.
- **P0 / Em andamento:** além de exigir `current_user=provision_operator` sem privilégios, a operação rejeita `session_user` com SUPERUSER/BYPASSRLS/CREATEROLE/CREATEDB. Não transforma uma role NOLOGIN em LOGIN e não concede acesso adicional. A delegação segura continua pendente.
- **P0 / Bloqueada:** endpoint de aceite HTTP permanece desabilitado por identidade SQL falsificável; nenhuma autorização para habilitar antes da correção.
- **P1 / Pendente:** executar migrations em branch Neon de teste isolada, com validação das permissões e conexão TLS efetiva, sem aplicar no banco principal.
- **P1 / Pendente:** confirmar GitHub Actions no SHA final do ciclo antes de marcar o conjunto validado.


## Validação isolada de migrations — 15/11/2026

- Criada branch Neon não padrão `pagino-task-04c-validation` (`br-icy-king-b6kbstg3`) a partir do projeto Pagino, com compute limitado a 0.25 CU. A tentativa de configurar suspensão em 300s foi recusada pelo plano; a branch foi criada sem alterar o default.
- Aplicadas em transações separadas as migrations `0000` a `0004` e, depois, `0005_provision_operator_login.sql`. A primeira tentativa do parser de migrations incluiu indevidamente o marcador Drizzle como comentário e aplicou apenas a primeira instrução de `0000`; a aplicação restante foi executada com separação corrigida, seguida das migrations completas.
- `describe_branch` confirmou schemas `pagino` e `pagino_auth`, tabelas de domínio, índices e função `accept_initial_owner_invitation`.
- Consulta de catálogo confirmou RLS e FORCE RLS em todas as tabelas do schema `pagino`; `app_runtime` e `auth_runtime` não possuem SELECT nas tabelas de convites e operações; a função SECURITY DEFINER não pode ser executada por app_runtime, auth_runtime ou provision_operator.
- `provision_operator_login` foi criado como LOGIN + NOINHERIT, sem SUPERUSER/CREATEDB/CREATEROLE/BYPASSRLS, com membership e atributo SET para `provision_operator`. A consulta confirmou que a identidade pode assumir a role, mas a conexão autenticada real ainda não foi testada porque nenhuma senha foi atribuída.
- **Bloqueio externo restante:** configurar uma senha forte para `provision_operator_login` pelo Neon Console e armazenar a URL resultante em secret de ambiente dedicado, fora do Git. Não configurar esse segredo na Vercel de produção nesta etapa.
- Nenhuma migration foi aplicada na branch Neon principal; nenhum dado real foi alterado.


## Delegação do operador — atualização

A migration `0005_provision_operator_login.sql` cria `provision_operator_login` como `LOGIN NOINHERIT`, sem privilégios elevados, e concede apenas a associação necessária para `SET ROLE provision_operator`. O serviço agora executa explicitamente `SET ROLE provision_operator` e valida ambas as identidades (`current_user` e `session_user`), incluindo `rolinherit=false` no login.

O migration foi aplicado com sucesso à branch isolada `br-icy-king-b6kbstg3`; consultas confirmaram:
- login `provision_operator_login`: LOGIN, NOINHERIT, sem SUPERUSER/CREATEDB/CREATEROLE/BYPASSRLS;
- membership e atributo SET para `provision_operator`;
- nenhuma permissão para criar membership ou executar a função de aceite;
- RLS + FORCE RLS nas tabelas do schema `pagino`;
- app/auth runtime sem SELECT nas tabelas de convite/operação;
- função de aceite não executável pelas roles runtime nem pelo operador.

A senha da role não foi definida. Para habilitar a conexão operacional, uma credencial forte precisa ser definida fora do Git no Neon e guardada em secret privado do ambiente de execução. A ausência de senha mantém o worker inoperante por padrão.


## Logins isolados dos runtimes — migration 0006

A migration `0006_runtime_logins.sql` cria `app_runtime_login` e `auth_runtime_login` como LOGIN + NOINHERIT, sem privilégios elevados, cada um membro somente da respectiva role NOLOGIN. Os pools Postgres executam `SET ROLE app_runtime` ou `SET ROLE auth_runtime` em **cada conexão aberta** via `onconnect`, para não depender de estado de uma conexão específica do pool. Os URLs em `.env.example` agora indicam os logins dedicados.

A migration foi aplicada manualmente na branch Neon isolada `br-icy-king-b6kbstg3`; consulta de catálogo confirmou ambos os logins NOINHERIT, sem privilégios elevados, e membership SET apenas para o runtime correspondente. As senhas não foram definidas. Configuração de senha e secrets de ambiente continuam sendo intervenção externa, fora do Git.

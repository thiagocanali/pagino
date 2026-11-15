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

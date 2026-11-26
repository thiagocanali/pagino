# TASK 04-C — Contrato de segurança para aceite de convites

**Estado:** executor interno integrado à sessão Better Auth; **HTTP não habilitado**. O endpoint `POST /api/invitations/accept` responde 503. O cadastro público do Better Auth permanece desabilitado.

## Fronteiras de confiança

1. O navegador é não confiável: token de convite, identificadores de usuário, tenant, papel e e-mail enviados pelo cliente não autorizam nenhuma promoção.
2. A API autentica a sessão Better Auth e aplica proteção de origem, limites de tamanho, rate limit e resposta uniforme para convites inválidos. A sessão deve ser validada novamente no momento da mutação.
3. O PostgreSQL é a autoridade final para vínculo **sessão válida → usuário → e-mail verificado → convite**. A função atual `pagino.accept_initial_owner_invitation(p_user_id, p_token_hash)` **não é segura para exposição**: o `p_user_id` é um argumento livre, mesmo quando a API o obtém da sessão. Não conceder EXECUTE às roles `app_runtime`, `auth_runtime`, `provision_operator` ou `public_reader`.
4. O executor de aceite precisa de identidade de conexão separada, `LOGIN NOINHERIT` e role `NOLOGIN` de privilégios mínimos. Nunca reutilizar a credencial do operador de provisionamento, do adaptador Better Auth ou do runtime do domínio.
5. A função privilegiada deve consultar `pagino_auth.session` **dentro da mesma transação** que cria membership, valida `expires_at > now()`, obtém o `user_id` diretamente do registro de sessão, valida o e-mail verificado no registro do usuário e confere o hash do convite. O cliente não escolhe `user_id`.
6. A credencial da sessão não pode ser escrita em logs, auditoria, URL, métricas ou erros. O executor consulta `getSession` do Better Auth com `disableCookieCache`, encaminha apenas o token devolvido pelo servidor e deixa o PostgreSQL revalidar a sessão. O cookie bruto permanece na camada de autenticação.
7. A função faz lock do convite e da instituição, rejeita estado diferente de `sent`, token expirado/usado, instituição suspensa e membership pré-existente; cria owner, marca o convite consumido, limpa o token cifrado e grava auditoria na mesma transação. Replays e concorrência devem resultar em exatamente um owner e uma auditoria.
8. A identidade dedicada só pode executar a função restrita; não pode ler tabela de usuários/sessões ou inserir memberships diretamente. Não expor uma função alternativa que aceite `p_user_id` como autoridade.

## Casos de teste obrigatórios antes de habilitar HTTP

- Cookie ausente, inválido, expirado, revogado, sessão de outro usuário e cookie adulterado.
- E-mail não verificado, usuário com e-mail alterado, destinatário diferente e convite de outro tenant.
- Token inválido, expirado, não enviado, já consumido, concorrência e replay.
- Usuário já membro (incluindo viewer) não recebe promoção implícita.
- Role app/auth/provisioner/public_reader sem EXECUTE; executor com apenas EXECUTE, sem acesso direto às tabelas sensíveis.
- CSRF/origin, JSON estrito, limites de payload, rate limit, no-store e mensagens que não revelem a existência de contas/convites.
- Teste de ponta a ponta com login real Better Auth, cookie real e PostgreSQL descartável; depois validação em branch Neon isolada com credenciais dedicadas.

## Dependência para cadastro por convite

O cadastro inicial não pode usar `disableSignUp: false` globalmente. Exige fluxo separado que valide convite e destinatário, crie identidade com confirmação de e-mail e **não** conceda membership até a aceitação transacional segura. Falha em qualquer etapa não pode criar owner por payload de cliente.

**Critério de liberação:** CI verde, E2E real e revisão explícita de privilégios. Nenhuma migração na branch principal Neon, segredo remoto ou deploy de produção faz parte desta etapa.

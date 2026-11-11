# Papéis e permissões

Papéis fixos por membership ativa. Usuário pode ser owner em A e viewer em B. Selecionar tenant ou conhecer UUID não concede acesso. Negação por padrão; sessão válida, e-mail verificado e instituição ativa obrigatórios no painel.

| Ação no próprio tenant | Owner | Admin | Editor | Viewer |
| --- | --- | --- | --- | --- |
| Ler rascunhos, biblioteca e preview | Sim | Sim | Sim | Sim |
| Editar nome/dados institucionais (sem slug) | Sim | Sim | Não | Não |
| Editar marca/template/páginas/eventos | Sim | Sim | Sim | Não |
| Enviar mídia, editar alt e remover mídia sem referências | Sim | Sim | Sim | Não |
| Publicar, retirar e restaurar publicação para rascunho | Sim | Sim | Não | Não |
| Ler histórico de publicações | Sim | Sim | Sim | Sim |
| Consultar auditoria | Sim | Sim | Não | Não |
| Convidar/gerir editor e viewer | Sim | Sim | Não | Não |
| Convidar/gerir admin | Sim | Não | Não | Não |
| Transferir ownership | Sim, reautenticação | Não | Não | Não |
| Suspender/excluir instituição ou mudar slug | Procedimento operacional | Não | Não | Não |

Owner não remove outro owner nem concede owner por convite genérico: transferência explícita para membro ativo/verificado torna o owner anterior admin atomicamente. Convite inicial de owner é exclusivo do provisionamento. Admin não altera o próprio papel nem memberships de admin/owner. Todos podem revogar suas próprias sessões e sair da instituição, salvo último owner. Ninguém edita auditoria ou publicação imutável.

## Aplicação

Permissões centrais: institution.read/update, membership.manage_limited/manage_admin/transfer_owner, content.read/write, media.read/write, site.publish/unpublish/restore, audit.read. Mapear papel → permissões em módulo central; UI usa apenas para apresentação. Serviços verificam sessão, ação e objeto em cada operação. RLS reforça tenant e membership ativa; autorização de papel também ocorre no serviço, inclusive contra chamadas diretas à API.

401 para falta de sessão; 403 para ação sem permissão no próprio tenant; 404 genérico para recurso de outro tenant/instituição não pertencente ao usuário. Não revelar existência de instituições alheias. Papel no cookie ou cache não é fonte de autorização. Revogação vale na próxima operação; transferência e último owner exigem lock transacional. Sem UPDATE genérico de memberships.

## Operador da plataforma

Não é papel de tenant nem flag isAdmin no cliente. Provisionamento e suspensão no MVP são operações restritas com identidade separada, justificativa e auditoria actor_kind=platform_operator. Sem painel superadmin ou impersonação. Credencial de operador não pertence ao runtime comum. Owner solicita suspensão/exclusão por canal operacional definido no piloto; testes garantem que owners não acessam tais operações via API de tenant.

Visitante lê apenas a publicação ativa e mídias nela referenciadas. Background jobs futuros exigem identidade e contexto de tenant explícitos. Testes completos em [TESTING](TESTING.md).

# Modelo de dados conceitual

Proposta sem DDL/migrations. Domínio usa UUID; Better Auth usa IDs do schema gerado da versão fixada (não presumir UUID); FKs de usuário têm tipo compatível. Datas técnicas em timestamptz/UTC; eventos também guardam timezone IANA. Não armazenar cadastro de membros/doadores ou dados sensíveis de visitantes.

## Entidades

| Entidade / schema lógico | Campos e relações | Invariantes |
| --- | --- | --- |
| pagino_auth.user | id, name, email, emailVerified, timestamps | Usuário global; e-mail único/normalizado conforme biblioteca |
| pagino_auth.account/session/verification | Schema gerado Better Auth, FKs correspondentes | Dados privados; hashes/tokens conforme contrato da biblioteca; sem auth próprio paralelo |
| institutions | id, name, slug, status(active/suspended), timestamps | Slug global único e estável; suspensão bloqueia administração/público |
| memberships | id, institution_id, user_id, role, status(active/revoked), timestamps | Unique(institution_id,user_id); não remover último owner; índice user_id/status |
| invitations | id, institution_id, normalized_email, role, token_hash, expires_at, accepted_at, revoked_at, invited_by | Token não persiste em claro; um convite pendente por tenant/e-mail; expiração no serviço; aceite único atômico |
| sites | id, institution_id, template_key/version, draft_version, published_publication_id, timestamps | Unique(institution_id); ponteiro somente para publicação do mesmo site/tenant |
| site_settings | id, institution_id, site_id, visual_identity, navigation, seo_defaults, version | Unique(site_id); JSON validado; referências de mídia normalizadas |
| pages | id, institution_id, site_id, slug, title, seo, sections, version, archived_at, timestamps | Unique(site_id,slug); home obrigatória para publicar; JSON estruturado sem HTML livre |
| events | id, institution_id, site_id, slug, title, description, location, starts_at, ends_at, timezone, version, archived_at | Unique(site_id,slug); fim ≥ início; timezone válido |
| media | id, institution_id, storage_key, original_name, detected_mime, size_bytes, width, height, alt_text, decorative, status, reservation_expires_at, created_by, timestamps | Chave única imutável; pending/quarantined/ready/deleting/deleted; reserva conta na quota |
| draft_media_refs | institution_id, site_id, resource_type/id, media_id | Serviço mantém referências tipadas e valida recurso no mesmo tenant/site em transação |
| publications | id, institution_id, site_id, sequence, snapshot_schema_version, template_key/version, snapshot, draft_version, created_by, created_at, idempotency_key | Unique(site_id,sequence) e unique(site_id,idempotency_key); imutável; inclui marca, navegação, páginas/eventos |
| publication_media | institution_id, site_id, publication_id, media_id | Unique(publication_id,media_id); bloqueia exclusão física de mídia de versões retidas |
| audit_logs | id, institution_id, actor_user_id nullable, actor_kind, action, entity_type/id, changed_fields, request_id, created_at | Append-only; allowlist/redação de campos; sem tokens, URLs assinadas ou snapshots completos |

Template é catálogo de código e não entidade editável pelo tenant. Defaults começam como rascunho, sem conteúdo real de terceiros.

## Constraints e índices

institution_id obrigatório nas tabelas de domínio; institutions usa a própria PK como tenant. Entidades referenciadas expõem unique(institution_id,id); FKs compostas usam institution_id + resource_id, incluindo mídia e publicação. Incluir site_id nas relações quando necessário para impedir cruzamento entre sites futuros. Ponteiro de publicação é nullable e FK composta; dependência circular é instalada após criar publications.

draft_media_refs polimórfica não tem FK genérica para páginas/eventos: antes da migration, usar tabelas de referência por tipo (page_media, event_media, settings_media), com FKs compostas reais; nome agregado acima é apenas conceitual. Não confiar só na validação de IDs em JSON para integridade.

Índices começam por institution_id em consultas administrativas, depois site/status/slug/data conforme uso. Indexar FKs e membership usadas nas policies. Cursor (created_at,id); auditoria (institution_id,created_at,id); eventos (institution_id,site_id,starts_at,id). Evitar índices JSON indiscriminados; medir com EXPLAIN e dados sintéticos representativos.

RLS conforme [arquitetura](ARCHITECTURE.md). public_reader só lê colunas mínimas de institution/site e snapshot apontado; sem auth, e-mails, drafts ou auditoria. JSON público não contém atores, e-mails administrativos ou caminhos privados; IDs de mídia são resolvidos após verificar publication_media. Não persistir URLs assinadas no snapshot.

## Transações e concorrência

- Gravação editorial bloqueia site, incrementa draft_version e valida versão do recurso; ordem de locks consistente site → recurso → mídia.
- Publicação bloqueia site, valida versão recebida, lê rascunho consistente, verifica media ready, grava snapshot/referências/auditoria e move ponteiro atomicamente. Mesma idempotency_key retorna mesma publicação.
- Convite, aceite, revogação e transferência serializam por instituição; duas remoções não podem eliminar todos os owners.
- Reserva de mídia serializa quota por instituição. Finalização verifica objeto, nunca confia no cliente.
- Storage/e-mail não participam da transação DB: estados, reenvio e reconciliação idempotente são obrigatórios.

## Histórico e retenção proposta

Auditoria registra campos alterados, sem reconstrução de cada edição de rascunho. Histórico restaurável é de publicações completas. Restaurar copia snapshot para rascunho e gera auditoria, preservando publicação original.

Durante piloto, reter publicações e mídias referenciadas; rever custo/teto antes de escalar. Auditoria por 180 dias como política inicial sujeita à revisão legal. Expirar e limpar tokens conforme biblioteca. Suspensão não exclui dados automaticamente. Exclusão definitiva exige procedimento autorizado LGPD, incluindo objetos, referências e backup. Anonimização pode anular FK de ator, preservando registro pseudônimo quando houver base legal. Sem cascade destrutivo de tenant sem política e teste.

Schemas físicos previstos: pagino para domínio e pagino_auth para Better Auth. Não usar nem modificar o schema auth gerenciado do Supabase. Confirmar suporte/mapeamento do adapter na TASK 03.

## Implementação inicial e limites

Migrations 0000/0001 implementam somente tabelas Better Auth oficiais e o núcleo institutions, memberships, sites, pages e audit_logs. O restante deste documento é modelo-alvo. Ainda não há publication pointer, eventos, convites, mídia, settings ou APIs institucionais. Auditoria mínima desta prova usa ator obrigatório, ação e recurso; operador/política de anonimização serão ampliados antes do provisionamento real. Não presumir que campos planejados já existam. Grants não permitem que runtime altere memberships nem provisione instituições; os serviços operacionais seguros virão com as próximas fases.

No incremento 04, a migration 0002 acrescenta pagino_auth.rate_limit conforme geração oficial Better Auth, com key única, contador e último instante. Auth_runtime recebe DML explícito nessa tabela; nenhum grant ao público/domínio é acrescentado. As APIs de leitura institucional/autenticação agora existem; demais campos e entidades do modelo-alvo continuam futuros.

## Migration 0003 — desafios de e-mail

`pagino_auth.email_challenges` é identidade global privada, com FK para user, propósito reset/verify, hash único do segredo opaco, token nativo cifrado pelo Better Auth, destinatário, expiração, uso e estado pending/sent/failed. Auth_runtime tem DML; público/domínio não recebem grants. Índices por expiração e usuário/propósito/uso apoiam invalidação e manutenção.

Conclusão bloqueia user e challenge, valida propósito/prazo/entrega/uso, executa a operação Better Auth no mesmo tx e invalida todos os irmãos do propósito. Ciphertext é apagado ao consumir. Reset nativo usa identifiers hashed. Login também bloqueia user, impedindo criar sessão por senha antiga depois da revogação. Limpeza de desafios, verificações e mensagens locais faz parte da operação antes do piloto.

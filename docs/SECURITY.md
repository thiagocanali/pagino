# Segurança e privacidade

## Modelo de ameaça

Fronteiras: navegador não confiável → Nitro → PostgreSQL/Storage; painel → site público; instituição A → B; runtime → operação privilegiada. Ativos: sessões, dados editoriais, imagens, publicações e auditoria. Ameaças principais: IDOR, vazamento de tenant/contexto em pool/cache, XSS, CSRF, elevação de papel, upload malicioso, roubo de conta e credencial privilegiada exposta.

| Risco | Controle obrigatório | Evidência antes do piloto |
| --- | --- | --- |
| Acesso cruzado | Sessão + membership + ação + tenant no servidor, FKs compostas, RLS/grants mínimos | API e SQL negativos A/B, inclusive INSERT/UPDATE com FK alheia |
| Contexto residual | Transação com set_config local; falta de contexto nega; sem global mutável | Reuso concorrente do pool, commit/rollback e requisição anônima |
| Credencial privilegiada | Roles separadas auth/domínio/leitor/migration; Storage em adaptador restrito | Inspeção de grants/roles, bundle e logs |
| XSS/SSRF | JSON tipado, sanitização de rich text, escaping Vue, allowlist de URLs; sem fetch de URL arbitrária | Payloads maliciosos, protocolos/embeds rejeitados |
| CSRF/sessão | Proteções Better Auth ativas; Origin confiável e CSRF nas mutações customizadas; cookies seguros | Origem externa negada; nenhuma mutação por GET; testes SSR/logout/reset |
| Abuso auth/upload | Limitação persistente por IP/conta/tenant, respostas genéricas, quota/reservas | Concorrência, brute force e retry; contador só em memória não basta na Vercel |
| Corrupção editorial | Versões, locks, idempotência, snapshot atômico | Corridas de edição/publicação/ownership e falha injetada |
| Supply chain | Lockfile, versões estáveis, permissões mínimas de CI, revisão de dependências | CI sem secrets de produção e revisão de alertas aplicáveis |

Rate limiting persistente usará inicialmente PostgreSQL, sujeito à medição de carga; não pressupor Redis ou serviço pago. Endpoints públicos também recebem limites compatíveis com tráfego legítimo. Não registrar IP bruto indefinidamente.

## Better Auth como única identidade

Sem Supabase Auth. Usar hashing e validação de tokens da biblioteca, nunca criptografia própria. Senhas com mínimo inicial de 12 caracteres e máximo de pelo menos 64 suportado, sem truncamento silencioso; validar limites contra biblioteca. Reautenticação recente (até 10 minutos) para transferência de owner e mudanças críticas de conta. Tokens de convite do domínio são aleatórios, criptograficamente seguros, armazenados por hash, de uso único; não são sessões.

Cookies Secure/HttpOnly/SameSite=Lax/host-only em HTTPS; desenvolvimento local tem configuração explícita. URL base e trusted origins por ambiente, sem wildcard genérico de previews. Verificar expiração/revogação no servidor; estado da UI não autentica. Mensagens de recuperação/login não revelam conta existente. Configurar tempos do PRD e proteção contra força bruta. MFA é evolução; avaliar necessidade para operadores antes de produção. Nunca baixar o nível de proteção só para passar testes.

## Banco e RLS

Schemas privados, sem exposição automática por Data API. app_runtime sem DDL, owner ou BYPASSRLS; USING e WITH CHECK por tenant/membership, FORCE RLS e grants mínimos. auth_runtime só acessa tabelas Better Auth; public_reader só o snapshot ativo e metadados públicos mínimos. Role de migration só em execução administrativa autorizada, não build/preview.

GUC de tenant é contexto confiado ao Nitro após validar sessão: não é identidade verificável pelo banco. SQL parametrizado e encapsulamento dos repositórios são essenciais. RLS deve falhar sem contexto; validar INSERT/UPDATE/DELETE/SELECT separadamente. Nenhum acesso normal via postgres/service_role. Evitar SECURITY DEFINER; qualquer exceção futura requer search_path fixo, grants mínimos e revisão.

## Mídias

Buckets privados. Browser só recebe capacidade assinada para chave exata e sem overwrite após autorização. Assinatura privilegiada ignora policies RLS de Storage; o adaptador checa sempre instituição, papel, quota e estado no DB. Nenhuma chave privilegiada no cliente. Credenciais distintas por ambiente; não reutilizar banco alheio.

Finalização inspeciona bytes e imagem decodificada, aplica limites de dimensão/tamanho e remove metadados EXIF antes de disponibilizar derivado seguro. Não renderizar original não validado; bloquear SVG, arquivos poliglotas, MIME divergente e bombas de descompressão. Originais rejeitados ficam em quarentena e são removidos por rotina idempotente. Upload assinado usa prazo suportado pelo serviço; registrar o TTL efetivo na implementação, sem prometer expiração que o SDK não oferece.

Leituras privadas autorizadas e públicas referenciadas recebem URL com TTL proposto de 5 minutos, nunca persistida em auditoria/snapshot. Links podem ser compartilhados até expirar; retirada não revoga cópias baixadas nem links existentes instantaneamente. Não vender isso como hospedagem de documentos sigilosos. Antes de excluir, verificar referências em todos os snapshots retidos. Banco e objetos reconciliados via Storage API, sem SQL em storage.objects.

## Auditoria e operação

Mutações de domínio e evento auditado na mesma transação; append-only para runtime. Registrar ator, instituição, ação, recurso, campos permitidos, horário e request_id. Eventos de login/falhas vão para log de segurança com redação; nunca registrar senha, token, cookie, URL assinada ou corpo inteiro. Alertar repetidas negações e falhas sem expor dados entre tenants.

TLS; headers de conteúdo, anti-framing, referrer-policy e CSP ajustada a Nuxt/SSR e origens necessárias. Evitar unsafe-eval e scripts de tenant. CSP deve ser testada com hidratação, não copiada sem validação.

Antes do piloto: definir RPO alvo de 24h e RTO alvo de 8h, validar se recursos autorizados os suportam, ensaiar backup/restauração em ambiente isolado e incluir objetos de Storage (backup DB não garante cópia dos arquivos). Sem prometer PITR/plano pago. Se recursos não atenderem, registrar limitação e resolver antes da entrada em produção.

## LGPD

Coletar somente equipe e contatos institucionais necessários. Uso por instituições religiosas pode revelar dados sensíveis: não coletar filiação, membros ou doações no MVP. Definir papéis controlador/operador, base legal, termos, política de privacidade, canal de direitos, subprocessadores, região e retenção antes do piloto. Não instalar trackers por padrão. Consentimento não é base universal.

Incidente: conter acesso/rotacionar credencial comprometida, preservar evidências mínimas, avaliar alcance por tenant, restaurar integridade e comunicar responsáveis conforme obrigação aplicável. Nunca publicar dados ou credenciais na issue/PR de diagnóstico.

## Dependências — diagnóstico desta sessão

`npm audit --omit=dev` reportou 18 entradas no grafo instalado (0 altas/críticas; 12 moderadas e 6 baixas), incluindo cadeias de ferramentas de build/CLI presentes no pacote Nuxt. Entre os avisos base estão minimatch/glob, deepmerge e esbuild transitivo da CLI Drizzle. Não foi aplicado downgrade automático de Nuxt/Drizzle sugerido pelo audit, pois afetaria compatibilidade. Estes avisos exigem triagem/atualização e nova verificação antes de piloto; não declarar o grafo livre de vulnerabilidades. Não há aplicação publicada ou devserver de esbuild da CLI exposto.

## Controles implementados no incremento 04

Cookie HttpOnly/SameSite=Lax/host-only e Secure quando a origem é HTTPS; cookie cache desabilitado, expiração absoluta de 7 dias, origem única validada e ausência de signup. Tentativas são limitadas atomicamente em Postgres e persistem entre instâncias. Resposta de login para conta ausente, senha errada ou e-mail não verificado é genérica.

APIs GET /api/me, /api/me/institutions e /api/institutions/{id}/pages|audit requerem sessão real. Contexto é derivado da identidade autenticada e revalidado por membership/RLS; cabeçalhos x-user-id/x-role não concedem permissão. Falta de sessão gera 401; falta de papel no tenant conhecido, 403; tenant alheio/inativo ou ID inválido, 404. Memória global guarda conexões, nunca identidade/tenant de requisição.

Segredos de teste são efêmeros. E2E de autenticação não grava traces/vídeos ou storageState, evitando cookies em artefatos. Leitura de JSON de login e /api/me é testada para ausência de tokens. Falha de exclusão no logout não pode retornar sucesso.

Antes do piloto: recuperar/verificar e-mail com transporte real autorizado; provisionamento de usuários e convites; rate limiting por proxy de hospedagem confirmado; limite upstream de corpo (o parser limita 8 KiB, mas bufferiza antes da validação efetiva); teste de Supavisor/Vercel e cookies HTTPS na infraestrutura real. Os testes HTTPS locais do factory não substituem essa homologação.

O HMAC anonimiza a chave do contador adicional de tentativas; os metadados de sessão e o limiter nativo Better Auth podem armazenar o IP normalizado recebido pelo servidor. A política de retenção/limpeza desses registros precisa ser aplicada antes do piloto; não confundir chave pseudonimizada com ausência completa de dados de rede.

## Controles implementados no incremento 04-B

Recuperação e verificação só estão disponíveis com transporte configurado. Runtime aceita apenas transporte de desenvolvimento loopback, sem redirects HTTP; env vazio mantém 503. Coletor requer chave privada, não serve inbox público e grava arquivos 0600 em diretório ignorado pelo Git. Nenhum envio externo foi realizado.

Segredos opacos de 256 bits ficam no fragmento, fora da URL HTTP e do SSR. Router remove fragmento do endereço/history.state. Não armazenar em localStorage, logs, traces ou cookies. DB mantém somente hash do segredo e ciphertext do token nativo; consumo limpa o ciphertext. Endpoints de conclusão são POST, origem única, JSON estrito, limite persistente e prazo/propriedade/propósito checados sob lock. GET não consome nem verifica.

Adapter transacional, lock por usuário e invalidação de irmãos garantem uso único/rollback, revogação das sessões e ausência de sessão residual em corrida com login por senha antiga. Verificação não faz login automático. Respostas de solicitação são genéricas, inclusive sob falha de entrega; operador observa estado/log seguro. Piso de latência não é prova de tempo constante; revisar esse aspecto com provider real.

Antes do piloto: transporte externo autorizado e homologado, retries/monitoramento, purga de registros/mensagens expirados e políticas de retenção de PII. O coletor local é ferramenta de desenvolvimento, não serviço comercial de e-mail.

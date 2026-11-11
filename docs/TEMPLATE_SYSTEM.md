# Sistema de templates

## Contrato

Template é código confiável versionado da plataforma, separado dos dados de tenant. Cada definição declara key, version, schema de configuração/conteúdo, defaults, catálogo de seções, slots, renderer Vue e transformações de versão. Renderer recebe dados validados; não acessa banco nem decide autorização. Não executar HTML/CSS/JavaScript, SQL ou imports enviados por usuário.

institutional-classic@1 é o único template do MVP. Configurações são independentes; defaults globais nunca são mutados por instituição. Validação server-side rejeita propriedades desconhecidas, limites excedidos e versão não suportada. TypeScript não valida JSON externo.

## Institutional classic

| Área | Campos e limites iniciais |
| --- | --- |
| Cabeçalho | Logo, nome público, menu com até 8 itens internos |
| Hero | Título até 120 caracteres, texto até 500, imagem e até 2 CTAs |
| Sobre | Título, texto estruturado sanitizado até 10.000 caracteres e imagem opcional |
| Atividades/serviços | Até 12 cartões de título, resumo e imagem opcional |
| Eventos | Lista de eventos do snapshot e detalhe por slug |
| Contato | Endereço, telefone, e-mail institucional e links sociais; sem formulário/mapa incorporado |
| Rodapé | Nome, contatos e até 6 links |

Home exige hero e uma seção informativa; máximo 12 seções por página. Cabeçalho/rodapé globais; seções opcionais podem ser ocultadas/reordenadas dentro das regras. Rotas: home /s/{institutionSlug}; página /s/{institutionSlug}/{pageSlug}; evento /s/{institutionSlug}/eventos/{eventSlug}. Reservar eventos, admin, auth, api e nomes técnicos; normalizar e validar colisões no backend.

## Identidade e conteúdo

Tokens primary, secondary, background, text, logo_media_id e font_key de catálogo local com duas famílias aprovadas. Sem fonte/stylesheet externo arbitrário. Validar contraste nas combinações suportadas, tamanhos legíveis e mobile first. Imagens com alt ou marcação decorativa. Links https; mailto/tel somente em campos apropriados. Bloquear javascript/data e embeds. Links externos com proteção adequada quando abertos em nova aba.

Painel edita formulário por seção, apresenta limites, salva explicitamente e indica rascunho. Preview autenticado no painel usa o mesmo renderer, com no-store e noindex. Sem link público de preview.

## Versões e aceite

Snapshots imutáveis guardam template_version e snapshot_schema_version. Manter renderer das versões retidas; evolução migra rascunho por transformação pura/versionada, preview e publicação explícita. Nunca reinterpretar snapshot antigo silenciosamente. Restauração exige renderer suportado e mídia preservada. Migrações de templates são posteriores ao MVP.

Aceite: dois tenants mantêm identidade/conteúdo independentes; servidor rejeita JSON inválido; preview e snapshot equivalente têm mesmo resultado; teclado e responsividade funcionam; conteúdo malicioso é escapado/sanitizado; versão desconhecida falha preservando publicação anterior. Testes visuais usam fixtures sintéticas estáveis.

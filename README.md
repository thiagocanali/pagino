# Pagino

Seu site. Seu jeito. Seu controle.

SaaS multi-tenant para igrejas, ONGs, associações e pequenas empresas criarem e administrarem sites institucionais com templates configuráveis, sem depender de programadores. Primeiro template: `institutional-classic`.

## Estado atual — TASK 01

Fundação documental em 11/11/2026. A especificação da TASK 01 não implementa funcionalidades; a execução posterior passa a desenvolver o código em branches próprias. As decisões são propostas para revisão nesta PR; suporte documentado não equivale a integração testada. Não há comando de instalação ou execução nesta etapa.

Diagnóstico por consultas somente leitura:

- GitHub `thiagocanali/pagino`: público, vazio, sem branches antes desta tarefa; default declarado `main`. Criado apenas README inicial na `main` para permitir branch e PR, pois GitHub não abre PR contra uma história inexistente.
- Vercel: projeto existente `pagino`, sem deployments; framework não definido e Node configurado em `26.x`. Nenhuma configuração alterada. A documentação de produto recomenda avaliar Node 24 LTS na TASK 02, em vez de assumir compatibilidade da configuração atual.
- `https://paginoo.vercel.app/`: endereço inicial informado pelo proprietário; vínculo do alias não confirmado pela resposta consultada (lista de domínios vazia). Confirmar antes do primeiro deploy. Proteção SSO observada no projeto pode impedir acesso público: validar na tarefa de publicação sem contratar plano.
- Supabase: nenhum projeto listado foi identificado como Pagino. Projetos de outros produtos não foram inspecionados nem alterados. A implementação remota aguarda identificação/autorização de recurso dedicado.

## Mapa da documentação

| Documento | Finalidade |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Regras de contribuição e segurança |
| [Visão](docs/PRODUCT_VISION.md) | Público, problema, valor e objetivos comerciais |
| [PRD](docs/PRD.md) | Requisitos, fluxos e critérios de aceite |
| [Escopo](docs/MVP_SCOPE.md) | Limites e definição de pronto do MVP |
| [Arquitetura](docs/ARCHITECTURE.md) | Stack, compatibilidade e fronteiras de confiança |
| [Modelo de dados](docs/DATA_MODEL.md) | Entidades, relações e invariantes |
| [Permissões](docs/PERMISSIONS.md) | Papéis e autorização por instituição |
| [Templates](docs/TEMPLATE_SYSTEM.md) | Contrato do primeiro template |
| [Segurança](docs/SECURITY.md) | Ameaças, controles e operação |
| [Roadmap](docs/ROADMAP.md) | Incrementos ordenados, dependências e testes |
| [Decisões](docs/DECISIONS.md) | ADRs, justificativas e pendências |
| [Testes](docs/TESTING.md) | Estratégia de verificação e evidências |

## Próximo incremento

**TASK 02 — Bootstrap técnico local e CI de qualidade.** Criar Nuxt/Vue/TypeScript/Nitro com versões estáveis fixadas, página técnica acessível, endpoint de saúde sem dados sensíveis, Vitest, Playwright e GitHub Actions. Validar build para Vercel sem deploy e sem banco remoto. Ver [roadmap](docs/ROADMAP.md).

Desenvolvimento futuro usa branches e PRs revisadas. Merges são autorizados após validação e checks obrigatórios aprovados. Nenhum projeto/serviço pago deve ser criado implicitamente; nenhum deploy em produção está autorizado.

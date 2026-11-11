# Escopo do MVP

## Incluído

Um site por instituição, um template versionado (`institutional-classic`), idioma de interface pt-BR e conteúdo em um idioma. Painel central com seleção explícita de instituição, cadastro assistido, autenticação por e-mail/senha, convites, recuperação e papéis fixos. Páginas estruturadas, identidade visual, eventos informativos, biblioteca de imagens, preview privado, publicação atômica e auditoria administrativa. Cada publicação tem versão completa recuperável.

Site inicial por caminho: `https://paginoo.vercel.app/s/{institutionSlug}`; painel `/admin` e autenticação `/auth`. Slug da instituição é único e imutável no MVP. Não pressupor subdomínios de `vercel.app`, wildcard ou domínio comprado. Alterações de nomes não alteram URLs. Rotas são contratos propostos para implementação.

## Fora do MVP

Editor livre de arrastar e soltar; HTML/CSS/JavaScript de usuário; múltiplos sites por instituição; múltiplos templates ativos; domínio próprio; subdomínio por tenant; billing; autoatendimento público de criação de tenant; permissões customizadas; OAuth; Supabase Auth; MFA (reavaliar antes de produção sensível); blogs; formulários públicos; inscrições em eventos; doações; e-commerce; cadastro de membros; conteúdo sensível; internacionalização; agendamento de publicação e colaboração simultânea em tempo real.

## Limites técnicos iniciais propostos

Até 20 páginas e 100 eventos ativos por instituição; 500 imagens e 1 GiB por instituição, com até 5 MiB por arquivo e máximo de 4096×4096 pixels. Aceitar JPEG, PNG e WebP; sem SVG, PDF ou vídeo no MVP. Limites devem ser configuráveis e aplicados no servidor; validar custo/capacidade antes dos pilotos. Não constituem plano comercial contratado.

## Fluxo mínimo entregue

Responsável recebe acesso → autentica → escolhe instituição → configura marca → edita páginas/eventos → envia imagens → visualiza rascunho → publica → visitante consulta o snapshot público → responsável consulta auditoria e pode republicar versão anterior.

## Definição de pronto do MVP

Todos os critérios RF-01 a RF-10 e RNF do [PRD](PRD.md) atendidos; testes entre duas instituições e múltiplos papéis aprovados; nenhuma leitura de rascunho pelo público; perda de sessão e erros recuperáveis tratados; operação de backup/restauração ensaiada; segurança e acessibilidade revisadas; compatibilidade comprovada em preview autorizado; revisão humana antes de produção. Provisão Supabase, e-mail transacional, proteção pública da Vercel e elegibilidade comercial do plano são gates explícitos, não recursos já disponíveis.

A TASK 01 entrega somente a especificação. A TASK 02 não entrega o MVP inteiro.

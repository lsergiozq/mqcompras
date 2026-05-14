# Comprou?

Aplicativo web e PWA para lista de compras compartilhada, pensado para uso rapido no celular.

O foco do produto e reduzir atrito para pessoas que nao gostam de interfaces complexas: criar um Local, montar um catalogo simples, adicionar itens rapido e compartilhar a mesma lista com outras pessoas em tempo real.

## O que o app faz

- login com Google via Supabase Auth
- multiplos Locais por usuario
- lista de compras compartilhada em tempo real por Local
- catalogo de produtos organizado por corredores
- historico de compras finalizadas
- convite por link para entrar em um Local
- presets de catalogo, como "Itens do dia a dia"
- busca mais tolerante e sugestoes melhores ao digitar
- seletor simples de quantidade, sem depender de prompt do navegador
- PWA instalavel no Android, iPhone e desktop compativel

## Publico e direcao do produto

Este app foi sendo ajustado para um publico que prefere simplicidade:

- donas de casa
- trabalhadores domesticos
- idosos
- pessoas com pouca familiaridade com tecnologia

Por isso, o produto privilegia:

- poucos passos por acao
- textos claros
- botoes grandes
- reutilizacao do que a pessoa ja compra
- contexto util na tela da lista, como ultima compra

## Stack

- React 19
- Vite
- React Router
- Supabase
- Vite PWA
- ESLint
- Lucide React

## Requisitos

- Node.js 20+
- npm
- projeto Supabase configurado
- acesso ao painel do Supabase para Auth, banco e SQL Editor

## Scripts

- `npm run dev`: sobe o ambiente local com Vite
- `npm run build`: gera a build de producao
- `npm run preview`: serve localmente a build gerada
- `npm run lint`: roda ESLint no projeto

## Como rodar localmente

1. Instale as dependencias:

```bash
npm install
```

2. Crie um arquivo `.env` na raiz:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
```

3. Rode o projeto:

```bash
npm run dev
```

4. Para build de producao:

```bash
npm run build
```

## Configuracao obrigatoria no Supabase

O frontend depende de autenticacao, tabelas especificas, RPCs e presets de catalogo. Se alguma dessas partes faltar, o app abre mas alguns fluxos quebram.

### 1. Auth com Google

O login e feito exclusivamente com Google.

Checklist:

- ativar Google em Authentication > Providers
- configurar Client ID e Client Secret do Google
- incluir a URL local de desenvolvimento em Redirect URLs
- incluir a URL de producao em Redirect URLs

Exemplos de redirect:

- `http://localhost:5173`
- `https://SEU-DOMINIO.com`

Observacao importante:

O fluxo de convite usa redirecionamento para `/join/:token` depois do login quando existe um convite pendente. Isso depende de o dominio estar corretamente liberado no Supabase Auth.

### 2. Estrutura de banco esperada pelo frontend

O frontend atual usa o modelo `places`, nao o modelo antigo `families`.

Em alto nivel, o app espera estes recursos:

- `places`
- `user_places`
- `areas`
- `products`
- `list_items`
- `place_invites`
- `catalog_presets`
- `catalog_preset_areas`
- `catalog_preset_items`

E estas RPCs:

- `redeem_place_invite`
- `apply_catalog_preset`
- opcionalmente `list_catalog_presets_for_place` se o frontend for expandido para ofertar preset em Locais ja existentes e vazios

### 3. Campos esperados nas tabelas principais

Resumo funcional dos campos usados pelo frontend:

#### `places`

- `id`
- `name`

#### `user_places`

- `user_id`
- `place_id`

#### `areas`

- `id`
- `place_id`
- `name`
- `order_index`

#### `products`

- `id`
- `place_id`
- `area_id`
- `name`
- `thumbnail_url`
- `order_index`

#### `list_items`

- `id`
- `place_id`
- `product_id`
- `quantity`
- `is_purchased`
- `added_at`
- `archived_at`

#### `place_invites`

- `token`
- `place_id`
- `created_by`
- `expires_at`
- `max_uses`
- `uses`

#### `catalog_presets`

- `id`
- `slug`
- `name`
- `kind`
- `description`
- `sort_order`
- `is_active`

#### `catalog_preset_areas`

- `id`
- `preset_id`
- `name`
- `order_index`

#### `catalog_preset_items`

- `id`
- `preset_id`
- `area_id`
- `name`
- `thumbnail_url`
- `order_index`

### 4. Realtime

A tela da lista usa realtime do Supabase para `list_items` filtrado por `place_id`.

Se realtime nao estiver ativo para essa tabela, a lista ainda funciona, mas perde a atualizacao compartilhada em tempo real.

### 5. Storage

O projeto ja teve uso de thumbnails no Supabase Storage, mas hoje as imagens estao parcialmente desativadas na interface para reduzir custo.

Ou seja:

- o schema ainda tolera `thumbnail_url`
- o app ainda preserva URLs existentes
- mas a captura e exibicao de imagem nao sao o fluxo principal neste momento

## Aviso importante sobre `setup.sql`

O arquivo [setup.sql](./setup.sql) nao representa totalmente o estado atual esperado pelo frontend.

Ele ainda traz partes do modelo antigo baseado em `families` e `user_families`, enquanto o app atual trabalha com `places`, `user_places`, convites de Local e presets de catalogo.

Em resumo:

- nao use `setup.sql` como fonte unica de verdade
- revise o schema real do Supabase antes de subir um ambiente novo
- mantenha README e SQL alinhados quando houver mudanca estrutural

## Estrutura do projeto

### Entrada e shell

- `src/main.jsx`: bootstrap da app, providers e registro do service worker
- `src/App.jsx`: rotas, guards, header, navegacao inferior e gate de onboarding

### Estado global

- `src/AuthContext.jsx`: sessao autenticada do Supabase
- `src/PlaceContext.jsx`: Locais do usuario, Local atual e troca entre Locais

### Fluxos principais

- `src/Auth.jsx`: login com Google
- `src/Welcome.jsx`: onboarding quando o usuario ainda nao possui nenhum Local
- `src/ShoppingList.jsx`: lista de compras ativa
- `src/Catalog.jsx`: catalogo de produtos por Local
- `src/AddProduct.jsx`: criacao e edicao de produto
- `src/History.jsx`: historico de compras arquivadas
- `src/Settings.jsx`: compartilhamento, entrar por convite, atalhos do Local
- `src/Places.jsx`: lista de Locais do usuario
- `src/AddPlace.jsx`: criacao de novo Local com opcoes de inicio
- `src/ImportFromPlace.jsx`: importacao de produtos entre Locais do mesmo usuario
- `src/Join.jsx`: entrada por convite publico

### Helpers recentes

- `src/catalogPresets.js`: consumo de presets de catalogo no banco
- `src/productDiscovery.js`: busca tolerante e priorizacao de sugestoes
- `src/QuantityPickerModal.jsx`: seletor simples de quantidade
- `src/PWAInstallPrompt.jsx`: banner de instalacao do PWA

## Rotas principais

- `/login`: autenticacao
- `/welcome`: onboarding do primeiro Local
- `/`: lista de compras
- `/catalog`: catalogo
- `/settings`: configuracoes
- `/areas`: organizacao de corredores
- `/add`: criar ou editar produto
- `/history`: historico de compras
- `/places`: gerenciar Locais
- `/places/new`: criar novo Local
- `/import-products`: importar produtos de outro Local do usuario
- `/join/:token`: entrada por convite publico

## Fluxo funcional do usuario

1. O usuario faz login com Google.
2. O app carrega os Locais vinculados ao usuario.
3. Se nao houver nenhum Local, o usuario cai em `/welcome`.
4. Ao criar um Local, ele pode:
	- comecar vazio
	- aplicar um preset de catalogo, como "Itens do dia a dia"
	- copiar corredores e produtos de outro Local
5. O catalogo alimenta a lista de compras.
6. Os itens comprados podem ser finalizados e arquivados no historico.
7. O Local pode ser compartilhado por link de convite.

## Funcionalidades recentes que impactam UX

### 1. Presets de catalogo no onboarding

Ao criar um Local, o usuario pode escolher comecar vazio ou com um preset vindo do banco. Isso prepara o app para futuros presets como:

- Itens do dia a dia
- Escritorio
- Sitio
- Casa de praia

### 2. Busca mais tolerante

Na lista e no catalogo, a busca foi ajustada para:

- ignorar acentos
- tolerar pequenas variacoes de digitacao
- priorizar itens mais usados e mais recentes

### 3. Sugestoes mais inteligentes ao digitar

Na lista, o autocomplete do catalogo ficou melhor ordenado e pode mostrar contexto de ultima compra para o produto sugerido.

### 4. Quantidade sem prompt nativo

O app agora usa um seletor visual simples de quantidade, com:

- campo central
- botoes rapidos de 1 a 6
- edicao mais amigavel
- opcao de remover item ao editar quantidade na lista

### 5. Contexto de ultima compra na lista

O card da lista mostra quando aquele item foi comprado pela ultima vez, ajudando a decidir se vale repetir a compra.

## PWA

O projeto usa `vite-plugin-pwa` e registra automaticamente o service worker.

Comportamento atual:

- atualizacao automatica de service worker
- cache de assets estaticos
- cache de fontes do Google
- cache de imagens do Supabase Storage
- chamadas REST e realtime do Supabase continuam indo para rede

O componente `src/PWAInstallPrompt.jsx`:

- mostra CTA de instalacao em navegadores que disparam `beforeinstallprompt`
- mostra dica manual de instalacao no iPhone

## Deploy

O projeto esta pronto para deploy estatico.

### Vercel

O arquivo `vercel.json` faz rewrite para `index.html`, necessario para rotas SPA com React Router.

Checklist de deploy:

1. configurar `VITE_SUPABASE_URL`
2. configurar `VITE_SUPABASE_ANON_KEY`
3. garantir que o dominio de producao esta liberado no Supabase Auth
4. garantir que o Google OAuth aceita esse dominio
5. publicar

## Validacao basica apos subir o ambiente

Checklist rapido para confirmar que o sistema esta saudavel:

1. abrir o app e fazer login com Google
2. criar um Local vazio
3. criar um Local com preset de catalogo
4. adicionar produto do catalogo para a lista
5. editar quantidade
6. marcar item como comprado e finalizar compra
7. abrir historico
8. gerar convite e testar entrada em outro navegador ou aba anonima

## Troubleshooting

### O login com Google nao volta para o app

Verifique:

- Redirect URLs no Supabase Auth
- configuracao do provider Google
- dominio local ou de producao liberado

### O usuario loga, mas nao entra no Local convidado

Verifique:

- existencia da RPC `redeem_place_invite`
- validade do token de convite
- tabela `place_invites`
- permissao do usuario para acessar o Local depois do redeem

### O preset nao aparece ao criar Local

Verifique:

- tabelas `catalog_presets`, `catalog_preset_areas` e `catalog_preset_items`
- preset com `is_active = true`
- `slug`, `name` e `description` preenchidos

### O preset falha ao aplicar

Verifique:

- RPC `apply_catalog_preset`
- existencia das areas e itens do preset no banco
- permissao do usuario no `place_id`

### A lista nao atualiza em tempo real entre dispositivos

Verifique:

- realtime habilitado para `list_items`
- conexao com Supabase sem bloqueio de rede

### A busca parece ruim ou sem contexto

Lembre que as sugestoes melhoram quando existe historico de uso no Local. Em um Local completamente novo, a ordenacao parte mais do nome do produto do que de uso anterior.

## Limitacoes conhecidas

- o README esta mais atualizado que o arquivo `setup.sql`
- parte do fluxo de imagem esta intencionalmente desativada
- nao ha testes automatizados no repositorio neste momento
- o projeto ainda depende de um schema Supabase mantido manualmente

## Roadmap curto

Itens que fazem sentido como proximos passos sem complicar o uso:

- oferta de preset tambem para Local existente sem catalogo
- melhoria adicional do ranking de sugestoes com base em repeticao de compra
- documentar o schema real do Supabase em SQL versionado
- testes automatizados para fluxos criticos de onboarding e lista

## Resumo tecnico importante

Se voce abrir este projeto no futuro e quiser entender rapido o que e essencial, o resumo e este:

- o app depende de Supabase Auth + banco + RPCs
- o dominio atual do negocio e `places`
- a lista e o catalogo sao sempre escopados por `currentPlaceId`
- o onboarding depende do Local existir ou nao
- o compartilhamento depende de convites por token
- presets de catalogo ja sao parte do fluxo principal de criacao de Local

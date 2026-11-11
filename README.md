# Do Campo à Mesa

Mercado digital de produtores locais, desenvolvido em React, Node.js e MongoDB, com encomendas e leilões em tempo real. Inclui um backoffice de administração em Laravel.

Trabalho prático individual de Desenvolvimento Web e para a Cloud, do Mestrado em Engenharia Informática do IPVC–ESTG.

## Funcionalidades

- Catálogo público com pesquisa por produto, ingrediente e produtor, categorias, filtros de localidade, época, modo de produção e preço máximo, ordenação e paginação.
- Página pública do produtor com apresentação da exploração, produtos, avaliações e mapa. As coordenadas permitem marcar a exploração. Na sua ausência, o mapa pesquisa a localidade em Portugal.
- Registo de compradores e produtores, login, sessão persistente e acesso por papel. A publicação de produtos e leilões exige aprovação do produtor.
- Carrinho com controlo de quantidades, levantamento ou entrega, uma encomenda por produtor e reserva de stock.
- Acompanhamento das encomendas e notificações de alteração de estado em tempo real.
- Avaliações de produtos e produtores após a entrega, denúncias e moderação.
- Painel do produtor com gestão de produtos, fotografias, preços e stock, edição da exploração, indicadores de vendas e criação de leilões.
- Leilões com contagem sincronizada, presença, histórico, validação de propostas no servidor e criação da encomenda do vencedor.
- Painel React de administração com aprovação/rejeição de produtores, moderação e listas paginadas. Os leilões e indicadores são atualizados automaticamente a cada cinco segundos enquanto a página está visível.
- Backoffice Laravel ligado à mesma base MongoDB, com gestão, consultas e monitorização dos serviços.
- Interface Mobile First, navegação adaptada ao papel e apresentação para computador e telemóvel.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `api/` | API REST Express, modelos Mongoose, autenticação JWT, Socket.io e dados iniciais |
| `web/` | SPA React/Vite, componentes, páginas e estilos Bootstrap/SASS |
| `admin/` | Backoffice Laravel, Blade e integração MongoDB |
| `api/test/e2e/` | Testes Playwright da SPA e do Laravel |
| `api/test/interface/` | Testes de interface com respostas simuladas |
| `docs/` | Estrutura do relatório |

## Requisitos

- Node.js 20.19 ou superior e npm.
- MongoDB Atlas ou MongoDB local configurado como replica set. As transações dos leilões exigem um replica set.
- Para o backoffice, PHP 8.3 ou superior, Composer 2 e as extensões exigidas por `composer check-platform-reqs`, incluindo `mongodb`. Consultar [admin/README.md](admin/README.md).
- Ligação à Internet para apresentar os mapas Google Maps.

## Instalação e execução local

Executar os comandos a partir da raiz do repositório, em terminais separados.

### API

Executar em PowerShell na primeira instalação.

```powershell
cd api
npm install
Copy-Item .env.example .env
```

Configurar a ligação MongoDB e um `JWT_SECRET` próprio em `api/.env`, usando os campos seguintes.

```dotenv
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/do-campo-a-mesa?replicaSet=rs0
JWT_SECRET=substituir-por-um-segredo-longo-e-aleatorio
JWT_EXPIRES_IN=2h
CLIENT_URL=http://localhost:5173
STORAGE_CONN=
STORAGE_CONTAINER=produtos
```

Para Atlas, substituir o URI pelo fornecido pelo cluster e indicar a base de dados pretendida. A máquina tem de estar autorizada no acesso de rede do Atlas.

```powershell
npm run dev
```

API em <http://localhost:3000/api> e Swagger UI em <http://localhost:3000/api-docs>. O comando `npm start` executa o servidor sem reinício automático.

### Aplicação web

Executar os comandos seguintes na primeira instalação.

```powershell
cd web
npm install
Copy-Item .env.example .env
```

Preencher os campos seguintes em `web/.env`.

```dotenv
VITE_API_URL=http://localhost:3000
VITE_USAR_DADOS_SIMULADOS=false
```

```powershell
npm run dev
```

Abrir <http://localhost:5173>. Para validar a compilação, executar `npm run build` em `web/`.

O modo `VITE_USAR_DADOS_SIMULADOS=true` permite consultar o catálogo com dados do ficheiro JSON. Os fluxos de autenticação, compras e leilões usam a API.

### Backoffice Laravel

```powershell
cd admin
composer run setup
```

Configurar o `admin/.env` para usar a mesma base MongoDB da API, seguindo [admin/README.md](admin/README.md). Arrancar o backoffice com os comandos seguintes.

```powershell
php artisan config:clear
composer run dev
```

Abrir <http://127.0.0.1:8000> com uma conta de administrador. Nas instalações seguintes, usar `composer install`. O comando `setup` destina-se à instalação inicial e gera a chave da aplicação.

## Dados iniciais

Os comandos seguintes são opcionais e executam-se em `api/`.

| Comando | Comportamento |
|---|---|
| `npm run seed` | Apaga as seis coleções da base configurada e recria os dados de exemplo, incluindo avaliações |
| `npm run seed:testes` | Acrescenta contas e produtos de exemplo, preenche imagens e carrega avaliações |
| `npm run seed:avaliacoes` | Acrescenta avaliações, denúncias e encomendas associadas aos produtos existentes, sem alterar stock ou preços |

**Executar `npm run seed` apenas numa base que possa ser recriada.** Não é necessário voltar a executar os dados iniciais para arrancar uma instalação que já tenha dados.

O carregamento das avaliações pode ser repetido sem duplicações e preserva decisões de moderação anteriores.

O comando `npm run seed` cria as contas seguintes com a palavra-passe `password123`.

| Papel | Email |
|---|---|
| Administrador | admin@exemplo.pt |
| Produtor | horta@exemplo.pt |
| Produtor | mel@exemplo.pt |
| Comprador | tasca@exemplo.pt |

As contas adicionais de `seed:testes` usam `Testes123!`. As contas criadas pelo carregamento de avaliações usam `DemoAvaliacoes123!`. Estes dados destinam-se ao desenvolvimento.

## Localização dos produtores

Em **Painel do produtor → Editar página pública**, preencher a localidade e, opcionalmente, latitude e longitude. Ambos os campos de coordenadas têm de ser preenchidos em conjunto. Ao deixá-los vazios, a localização exata é removida e o mapa passa a mostrar a localidade.

O mapa é incorporado na página pública do produtor e nos detalhes dos seus produtos através do Google Maps. A apresentação depende da disponibilidade desse serviço. A ligação “Abrir no Google Maps” permite consultar a mesma localização numa janela separada.

## Imagens e configuração

A API aceita JPEG, PNG e WebP até 5 MB. Sem `STORAGE_CONN`, guarda as imagens em `api/uploads/`. Com a ligação Azure Blob Storage configurada, guarda-as no container indicado por `STORAGE_CONTAINER`.

A SPA usa o endereço de `VITE_API_URL` durante a compilação. O domínio permitido pela API e pelos sockets é definido em `CLIENT_URL`. Os ficheiros `.env`, os uploads, as dependências e os resultados de testes ficam fora do Git.

## Testes

Executar as verificações seguintes em `api/`.

```powershell
npm test
npm run docs:validate
npm run test:e2e
```

- `npm test` verifica a API, persistência, autorizações, stock, avaliações e concorrência com MongoDB temporário.
- `npm run docs:validate` valida a especificação OpenAPI.
- `npm run test:e2e` verifica a SPA, API e Socket.io com Playwright, incluindo responsividade. Os serviços e a base de dados são temporários.

A primeira execução Playwright exige a instalação do Chromium.

```powershell
npx playwright install chromium
```

As verificações específicas podem ser executadas em `api/`.

```powershell
npm run test:e2e:paginacao
npm run test:e2e:localizacao
npm run test:e2e:enunciado
npm run test:e2e:riscos
npm run test:e2e:leilao-destaque
npm run test:browser:carrinho-desktop
npm run test:e2e:admin
npm run test:e2e:navegadores
npm run test:e2e:todos
```

O teste de localização verifica o mapa do produtor e a indicação da localidade. O comando `test:e2e:navegadores` executa a suite em Chromium, Firefox e WebKit e exige os respetivos navegadores instalados. `test:e2e:todos` inclui a SPA, o carrinho e o backoffice Laravel.

Executar as verificações seguintes em `admin/`.

```powershell
composer test
composer test:mongodb
composer test:browser
```

As verificações MongoDB e Playwright do Laravel usam bases temporárias e exigem as dependências de `api/` e `web/` instaladas. Os resultados ficam em `api/test-results/` e `admin/test-results/`.

## Estado da entrega

A implementação local inclui a SPA, API documentada, autenticação, persistência, leilões, notificações e backoffice Laravel.

A entrega exige ainda os elementos seguintes.

- Publicação da SPA e API na Cloud, com HTTPS, WebSockets e endereços públicos.
- Armazenamento das imagens na Cloud e verificação das rotas internas após publicação.
- Relatório final com arquitetura, decisões técnicas, consistência dos leilões, resultados dos testes, custos e declaração das ferramentas e IA utilizadas.
- Vídeo de demonstração e preparação da defesa.

A estrutura do relatório encontra-se em [docs/relatorio.md](docs/relatorio.md).

# Administração · Do Campo à Mesa

Backoffice Laravel 13 com MVC, Blade e Eloquent, ligado diretamente à **mesma base MongoDB da API Node.js** através da [integração oficial MongoDB para Laravel](https://www.mongodb.com/docs/drivers/php/laravel-mongodb/current/). A aplicação React e a API continuam independentes.

## Funcionalidades

- Login com as contas existentes em `users`, exclusivo do papel `admin`; sessões em cookies, proteção CSRF, limitação de tentativas e logout.
- Painel com utilizadores registados, novos utilizadores nos últimos sete dias, produtores aprovados/pendentes, encomendas e valor de hoje e leilões em curso. O dia é calculado em `Europe/Lisbon`, incluindo mudanças de hora.
- Aprovação e rejeição de produtores pendentes, com filtros por estado. Uma decisão já tomada não é sobrescrita por outro formulário desatualizado.
- Moderação de avaliações denunciadas: ocultar, repor ou manter e resolver denúncias. Ocultar preserva a avaliação e as denúncias.
- Consulta paginada de utilizadores, encomendas (com linhas e totais) e histórico de leilões, com filtros.
- Indicadores e leilões atualizados automaticamente **por consulta HTTP a cada cinco segundos**; contagem decrescente no navegador. O histórico e as listas de gestão são atualizados ao navegar ou recarregar.
- Verificação de MongoDB, API, Socket.io, Swagger e storage a cada 30 segundos. Os estados são observados, sem indicadores Cloud simulados. O storage mostra “Não configurado” até existir um URL de verificação.

O servidor Node.js continua responsável pela licitação, pelo fecho dos leilões e pela criação das encomendas dos vencedores. O backoffice consulta essas operações; não altera o estado dos leilões nem das encomendas.

## Relação com o enunciado

Em **Componentes de valorização**, o enunciado prevê **+1 valor** para um backoffice Laravel (MVC, Blade, Eloquent), consumindo a mesma API ou base de dados, com nota final limitada a 20. Esta implementação escolhe a ligação direta à base de dados, conforme o diagrama de referência.

## Instalação

- PHP 8.3+, Composer 2 e as extensões exigidas por `composer check-platform-reqs`, incluindo `mongodb`, `fileinfo`, `mbstring`, `openssl`, `dom`, `xml` e `xmlwriter`.
- MongoDB local ou Atlas, com acesso à mesma base da API.

Para instalar a extensão PHP, seguir o [manual oficial](https://www.php.net/manual/en/mongodb.installation.php). Em Windows, o binário tem de corresponder à versão do PHP, arquitetura e TS/NTS. Verificar com `php --ini` e `php --ri mongodb`; reiniciar os processos PHP depois de alterar o `php.ini`.

Na primeira instalação:

```powershell
cd admin
composer run setup
```

Editar o `.env` criado, mantendo a chave `APP_KEY` privada:

```dotenv
DB_CONNECTION=mongodb
MONGODB_URI="mongodb://127.0.0.1:27017/do-campo-a-mesa?replicaSet=rs0"
MONGODB_DATABASE=do-campo-a-mesa
API_URL=http://127.0.0.1:3000
STORAGE_HEALTH_URL=
```

Copiar o valor real de `MONGODB_URI` do ambiente da API. Deixar `MONGODB_DATABASE` vazio para usar o nome indicado no URI; se o URI não indicar uma base, será usada `test`, tal como no Mongoose. Preencher `MONGODB_DATABASE` apenas para selecionar explicitamente a mesma base usada pela API. Para Atlas, usar o URI `mongodb+srv://...` e permitir o IP da máquina no cluster.

Os dados deste projeto foram copiados de `test` para `do-campo-a-mesa` em 22/10/2026. A configuração local da API e do Laravel aponta para a nova base. O procedimento e a verificação estão em [docs/migracao-mongodb.md](../docs/migracao-mongodb.md).

```powershell
php artisan config:clear
php artisan mongodb:verificar
composer run dev
```

Abrir <http://127.0.0.1:8000> e entrar com uma conta existente de papel `admin`. Se os dados de exemplo já tiverem sido inseridos pela API, a conta é `admin@exemplo.pt` / `password123`. Não há registo público nem uma segunda lista de administradores.

Nas instalações seguintes, usar `composer install`. `composer run setup` é para a instalação inicial e gera a chave da aplicação; não o executar para atualizar um ambiente com sessões existentes.

O layout usa CSS e JavaScript diretamente em `public/`, sem precisar de npm/Vite no backoffice. Sessões e cache usam ficheiros; a fila usa `sync`. O autoload é configurado para desenvolvimento; em produção pode ser otimizado com `composer install --no-dev --optimize-autoloader`.

## Compatibilidade dos dados

| Modelo Laravel | Coleção existente |
|---|---|
| `User` | `users` |
| `Encomenda` | `orders` |
| `Avaliacao` | `reviews` |
| `Leilao` | `auctions` |

Os modelos preservam ObjectIds, referências e documentos embebidos da API. Usam `createdAt`/`updatedAt`; o login verifica `passwordHash` com `password_verify`, compatível com bcryptjs, sem reescrever a password. Os formulários só alteram os campos previstos na decisão.

As migrations SQL de exemplo foram removidas. **Não executar `migrate:fresh`, `db:wipe` ou recriar as coleções partilhadas.** A base já é gerida pelos modelos e índices da API. `db:seed` deste backoffice não insere contas nem limpa dados.

As alterações diretas ao MongoDB ficam visíveis na API nas consultas seguintes. Com a API Node.js em execução, o observador `api/src/services/validacaoProdutores.js` acompanha as aprovações em `users` através de um change stream e emite `conta-validada` para a sala pessoal do produtor. A SPA atualiza a sessão e desbloqueia a criação sem recarregar. Não são partilhados tokens ou passwords entre Laravel e Node.js. É necessário Atlas ou um replica set local e uma conta MongoDB com permissão de `changeStream` e leitura em `users` no processo Node.js. Ao restabelecer a ligação Socket.io, a SPA volta a consultar o perfil para recuperar decisões tomadas durante uma interrupção.

## Serviços e deployment

`API_URL` configura as verificações de `/api/health`, do handshake Engine.IO e de `/api-docs/`. `STORAGE_HEALTH_URL` é opcional e deve apontar para um objeto existente que aceite `HEAD`; não há upload de teste. Os endpoints de estado estão protegidos pela sessão de administrador. Os URIs e credenciais não são devolvidos ao navegador.

Para produção: configurar HTTPS, `APP_DEBUG=false`, `APP_ENV=production`, `SESSION_SECURE_COOKIE=true` e guardar segredos no ambiente. A conta MongoDB precisa de ler as quatro coleções e atualizar `users` e `reviews`. O utilizador de testes nunca deve apontar para esta base.

## Verificação

```powershell
composer validate --strict
composer check-platform-reqs
composer test
composer test:mongodb
composer test:browser
```

`composer test` verifica o acesso e a página de login sem depender de MongoDB; a suite de integração é assinalada como ignorada. `composer test:mongodb` executa todas as suites num MongoDB temporário isolado, incluindo login com hash gerado por bcryptjs, permissões, persistência, moderação, estatísticas, filtros e falhas de serviços. Reutiliza `mongodb-memory-server` e `bcryptjs` de `api/node_modules`; instalar as dependências da API primeiro (`npm install` em `api/`). O runner reutiliza o binário MongoDB de testes da API quando disponível; na primeira execução pode precisar de o descarregar.

O `.env`, `vendor/`, sessões, cache e resultados de testes ficam fora do Git. `composer.lock` permite reproduzir a instalação.

`composer test:browser` utiliza Playwright da API, o cliente Socket.io de `web/node_modules` e um replica set MongoDB temporário, com documentos criados pelos próprios modelos Mongoose. Instalar primeiro as dependências de `api/` e `web/`. Verifica os formulários, a aprovação no Laravel seguida da notificação real por Socket.io, as decisões no MongoDB, a proteção CSRF, a atualização dos leilões, o layout em telemóvel e o logout. Se necessário, instalar o Chromium com `npx playwright install chromium` em `api/`. Guarda capturas em `admin/test-results/`.

# Administração · Do Campo à Mesa

Base [Laravel 13](https://laravel.com/docs/13.x) para o futuro backoffice exclusivo de administradores. É uma aplicação PHP independente de `api/` (Node.js) e `web/` (React).

## O que diz o enunciado

Em **Componentes de valorização**, o enunciado prevê **+1 valor** para um painel de administração em **Laravel (MVC, Blade, Eloquent)**, consumindo **a mesma API ou a mesma base de dados**. É um componente opcional; a nota final está limitada a 20 valores.

Nas secções **Intervenientes e funcionalidades** e **Administrador**, são apresentados:

- Aprovação ou rejeição de novos produtores.
- Moderação de avaliações denunciadas e conteúdos.
- Painel global de utilizadores, encomendas e leilões ativos.
- Consulta dos leilões em tempo real e do estado dos serviços Cloud.

Esta fase prepara apenas a estrutura. A página inicial é uma apresentação pública, sem dados nem operações de administração. Ainda não existem login, controlo do papel `admin`, chamadas à API, ligação ao MongoDB ou sockets.

## Pré-requisitos

- PHP 8.3 ou superior, com as extensões exigidas pelo Composer, incluindo `fileinfo`, `mbstring`, `openssl`, `pdo`, `dom`, `xml` e `xmlwriter`.
- Composer 2.

Em Windows, se o Composer indicar que falta `ext-fileinfo`, consultar `php --ini`, ativar `extension=fileinfo` no `php.ini` usado pela linha de comandos e abrir novamente o terminal. Não ignorar os requisitos de plataforma.

## Instalar e arrancar

A partir da raiz do repositório:

```powershell
cd admin
composer run setup
composer run dev
```

Abrir <http://127.0.0.1:8000>. O endpoint de saúde do Laravel está em `/up`.

O comando `setup` instala as dependências de `composer.lock`, copia `.env.example` para `.env` se necessário e gera `APP_KEY`. Executar na primeira instalação; se o `.env` já tiver uma chave em uso, usar apenas `composer install` para atualizar dependências.

O autoload não é otimizado nesta base de desenvolvimento para evitar uma análise completa dos ficheiros PHP em cada instalação. Na preparação de produção, pode ser gerado com `composer install --no-dev --optimize-autoloader`.

Sessões e cache usam ficheiros em `storage/` e a fila usa `sync`. Não é necessário configurar uma base de dados, executar migrations ou iniciar a API para abrir esta base. Os ficheiros de Eloquent, factories e migrations são os exemplos do Laravel e ainda não representam os dados da plataforma; não executar as migrations nesta fase.

O layout usa Blade e CSS servido diretamente de `public/css/admin.css`. Os ficheiros Vite de origem permanecem disponíveis para trabalho futuro; nesta fase não é necessário executar `npm install` ou `npm run dev`.

## Estrutura inicial

```text
app/Http/Controllers/PainelController.php   Página inicial
resources/views/layouts/admin.blade.php    Layout Blade
resources/views/admin/inicio.blade.php     Apresentação da base
public/css/admin.css                      Estilos iniciais
routes/web.php                            Rota GET / (admin.inicio)
.env.example                              Configuração local de exemplo
```

## Verificação

```powershell
composer validate --strict
composer check-platform-reqs
php artisan route:list
composer test
```

## Integração posterior

1. Definir o acesso exclusivo de administradores, validando a sessão e o papel `admin` com a autenticação existente.
2. Integrar os dados da plataforma através da API Node.js ou da mesma base MongoDB, conforme a opção escolhida. A API já disponibiliza recursos administrativos em `/api/admin`, protegidos por JWT e papel.
3. Implementar a validação de produtores, a moderação e o painel global, e depois os leilões em tempo real e o estado dos serviços.
4. Definir como usar Eloquent na integração escolhida: o enunciado menciona explicitamente MVC, Blade e Eloquent. A presença do modelo de exemplo do Laravel não conclui essa integração.

A integração e a autenticação têm de estar implementadas antes de disponibilizar operações ou dados reais neste backoffice. O `.env` e `vendor/` não são versionados; `composer.lock` é versionado para reproduzir a instalação.

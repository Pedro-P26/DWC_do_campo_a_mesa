<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'Administração') · Do Campo à Mesa</title>
    <link rel="stylesheet" href="{{ asset('css/admin.css') }}">
</head>
<body class="@auth autenticado @endauth">
    <a class="saltar" href="#conteudo">Ir para o conteúdo</a>
    @auth
        <aside class="barra-lateral">
            <a class="marca" href="{{ route('admin.inicio') }}">Do Campo à Mesa</a>
            <p class="etiqueta">Administração</p>
            <nav aria-label="Administração">
                @foreach (['inicio' => 'Visão geral', 'produtores' => 'Produtores', 'utilizadores' => 'Utilizadores', 'moderacao' => 'Moderação', 'encomendas' => 'Encomendas', 'leiloes' => 'Leilões', 'servicos' => 'Serviços'] as $rota => $rotulo)
                    <a href="{{ route('admin.'.$rota) }}" @if(request()->routeIs('admin.'.$rota)) aria-current="page" @endif>{{ $rotulo }}</a>
                @endforeach
            </nav>
        </aside>
    @endauth
    <div class="pagina">
        <header class="cabecalho">
            <div><p class="etiqueta">Do Campo à Mesa</p><h1>@yield('title', 'Administração')</h1></div>
            @auth
                <div class="sessao"><div><strong>{{ auth()->user()->nome }}</strong><small>Administrador</small></div>
                    <form method="POST" action="{{ route('admin.logout') }}">@csrf<button class="botao secundario" type="submit">Sair</button></form>
                </div>
            @endauth
        </header>
        <main id="conteudo">
            @if (session('mensagem'))<p class="aviso sucesso" role="status">{{ session('mensagem') }}</p>@endif
            @if ($errors->any())
                <div class="aviso erro" role="alert"><ul>@foreach ($errors->all() as $erro)<li>{{ $erro }}</li>@endforeach</ul></div>
            @endif
            @yield('content')
        </main>
        <footer class="rodape">Do Campo à Mesa · Administração</footer>
    </div>
    <script src="{{ asset('js/admin.js') }}" defer></script>
</body>
</html>

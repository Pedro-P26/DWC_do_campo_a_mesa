<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'Administração') · Do Campo à Mesa</title>
    <link rel="stylesheet" href="{{ asset('css/admin.css') }}">
</head>
<body>
    <header class="cabecalho">
        <a href="{{ route('admin.inicio') }}">Do Campo à Mesa</a>
        <span>Administração</span>
    </header>
    <main id="conteudo">
        @yield('content')
    </main>
</body>
</html>

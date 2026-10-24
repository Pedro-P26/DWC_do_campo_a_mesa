<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Serviço temporariamente indisponível</title>
    <link rel="stylesheet" href="{{ asset('css/admin.css') }}">
</head>
<body>
    <main class="cartao acesso">
        <h1>Não foi possível contactar o MongoDB</h1>
        <p>Os dados estão temporariamente indisponíveis. Tente novamente dentro de instantes.</p>
        <a href="{{ url()->current() }}">Tentar novamente</a>
    </main>
</body>
</html>

@extends('layouts.admin')
@section('title', 'Entrar na administração')
@section('content')
    <section class="cartao acesso" aria-labelledby="acesso-titulo">
        <p class="etiqueta">Acesso reservado</p><h2 id="acesso-titulo">Bem-vindo de volta</h2>
        <p>Entre com a sua conta de administrador.</p>
        <form method="POST" action="{{ route('login.store') }}" class="formulario">
            @csrf
            <label for="email">Email</label><input id="email" type="email" name="email" value="{{ old('email') }}" autocomplete="username" maxlength="254" required autofocus>
            <label for="password">Password</label><input id="password" type="password" name="password" autocomplete="current-password" maxlength="72" required>
            <button type="submit" class="botao">Entrar</button>
        </form>
    </section>
@endsection

@extends('layouts.admin')

@section('title', 'Visão geral')

@section('content')
    <div data-painel-url="{{ route('admin.estado') }}">
        <div class="atualizacao"><p data-atualizacao role="status">Atualização automática a cada 5 segundos.</p><button class="botao secundario" type="button" data-atualizar>Atualizar agora</button></div>
        <dl class="indicadores">
            <div class="cartao"><dt>Utilizadores registados</dt><dd data-indicador="utilizadores">{{ $indicadores['utilizadores'] }}</dd><small>+<span data-indicador="utilizadoresSemana">{{ $indicadores['utilizadoresSemana'] }}</span> nos últimos 7 dias</small></div>
            <div class="cartao"><dt>Produtores ativos</dt><dd data-indicador="produtores">{{ $indicadores['produtores'] }}</dd><small><span data-indicador="produtoresPendentes">{{ $indicadores['produtoresPendentes'] }}</span> por validar</small></div>
            <div class="cartao"><dt>Encomendas hoje</dt><dd data-indicador="encomendasHoje">{{ $indicadores['encomendasHoje'] }}</dd><small data-indicador="valorEncomendasHoje">{{ number_format($indicadores['valorEncomendasHoje'], 2, ',', ' ') }} €</small></div>
            <div class="cartao"><dt>Leilões em direto</dt><dd data-indicador="leiloesAtivos">{{ $indicadores['leiloesAtivos'] }}</dd><small>Em curso neste momento</small></div>
        </dl>
        <div class="grelha-painel">
            <div>
                <section class="cartao"><div class="titulo-secao"><h2>Produtores por validar</h2><a href="{{ route('admin.produtores') }}">Ver todos</a></div>@include('partials.produtores')</section>
                <section class="cartao"><div class="titulo-secao"><h2>Avaliações denunciadas</h2><a href="{{ route('admin.moderacao') }}">Ver todas</a></div>@include('partials.avaliacoes')</section>
            </div>
            <div>
                <section class="cartao"><div class="titulo-secao"><h2>Leilões ativos</h2><a href="{{ route('admin.leiloes') }}">Ver todos</a></div><div data-leiloes>@include('partials.leiloes')</div></section>
                <section class="cartao"><h2>Estado dos serviços</h2>@include('partials.servicos')</section>
            </div>
        </div>
    </div>
@endsection

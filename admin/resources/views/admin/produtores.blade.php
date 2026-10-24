@extends('layouts.admin')
@section('title', 'Produtores')
@section('content')
    <form class="filtros" method="GET">
        <label for="estado">Estado</label><select id="estado" name="estado">
            @foreach(['pendentes' => 'Por validar', 'aprovados' => 'Aprovados', 'rejeitados' => 'Rejeitados', 'todos' => 'Todos'] as $valor => $texto)<option value="{{ $valor }}" @selected($estado === $valor)>{{ $texto }}</option>@endforeach
        </select><button class="botao" type="submit">Filtrar</button>
    </form>
    <section class="cartao"><h2>{{ $produtores->total() }} produtores</h2>@include('partials.produtores'){{ $produtores->links() }}</section>
@endsection

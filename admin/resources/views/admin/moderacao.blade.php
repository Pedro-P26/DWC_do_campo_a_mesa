@extends('layouts.admin')
@section('title', 'Moderação')
@section('content')
    <form class="filtros" method="GET">
        <label for="estado">Avaliações</label><select id="estado" name="estado">
            @foreach(['denunciadas' => 'Denunciadas', 'ocultas' => 'Ocultas', 'todas' => 'Todas'] as $valor => $texto)<option value="{{ $valor }}" @selected($estado === $valor)>{{ $texto }}</option>@endforeach
        </select><button class="botao" type="submit">Filtrar</button>
    </form>
    <section class="cartao"><h2>{{ $avaliacoes->total() }} avaliações</h2>@include('partials.avaliacoes'){{ $avaliacoes->links() }}</section>
@endsection

@extends('layouts.admin')
@section('title', 'Leilões')
@section('content')
    <section class="cartao" data-painel-url="{{ route('admin.estado') }}"><div class="titulo-secao"><h2>Leilões em direto</h2><button class="botao secundario" type="button" data-atualizar>Atualizar agora</button></div><p class="metadados" data-atualizacao role="status">Atualização automática a cada 5 segundos.</p><div class="leiloes-grelha" data-leiloes>@include('partials.leiloes')</div></section>
    <form class="filtros" method="GET"><label for="estado">Estado</label><select id="estado" name="estado"><option value="">Todos</option>@foreach(['agendado', 'ativo', 'terminado'] as $estado)<option @selected(request('estado') === $estado)>{{ $estado }}</option>@endforeach</select><button class="botao" type="submit">Filtrar histórico</button></form>
    <section class="cartao"><h2>{{ $historico->total() }} leilões</h2><div class="tabela"><table><thead><tr><th>Lote</th><th>Produtor</th><th>Estado</th><th>Valor atual</th><th>Termina</th></tr></thead><tbody>
        @forelse($historico as $leilao)<tr><td>{{ $leilao->lote }}</td><td>{{ $leilao->produtorConta?->nome ?? 'Indisponível' }}</td><td>{{ $leilao->estado }}</td><td class="dinheiro">{{ number_format(data_get($leilao->licitacaoAtual, 'valor', $leilao->precoBase), 2, ',', ' ') }} €</td><td>{{ $leilao->terminaEm?->format('d/m/Y H:i') }}</td></tr>@empty<tr><td colspan="5">Não há leilões com estes filtros.</td></tr>@endforelse
    </tbody></table></div>{{ $historico->links() }}</section>
@endsection

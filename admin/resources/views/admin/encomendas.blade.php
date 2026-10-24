@extends('layouts.admin')
@section('title', 'Encomendas')
@section('content')
    <form class="filtros" method="GET"><label for="estado">Estado</label><select id="estado" name="estado"><option value="">Todos</option>@foreach(['pendente', 'confirmada', 'pronta', 'entregue'] as $estado)<option @selected(request('estado') === $estado)>{{ $estado }}</option>@endforeach</select><button class="botao" type="submit">Filtrar</button></form>
    <section class="cartao"><h2>{{ $encomendas->total() }} encomendas</h2><div class="tabela"><table><thead><tr><th>Encomenda</th><th>Comprador / produtor</th><th>Estado</th><th>Total</th><th>Produtos</th></tr></thead><tbody>
        @forelse($encomendas as $encomenda)
            <tr><td><code>{{ $encomenda->id }}</code><small>{{ $encomenda->createdAt?->format('d/m/Y H:i') }}</small></td><td>{{ $encomenda->compradorConta?->nome ?? 'Indisponível' }}<small>{{ $encomenda->produtorConta?->nome ?? 'Indisponível' }}</small></td><td><span class="selo">{{ $encomenda->estado }}</span><small>{{ data_get($encomenda->entrega, 'tipo') }}</small></td><td class="dinheiro">{{ number_format($encomenda->total, 2, ',', ' ') }} €</td>
                <td><details><summary>Ver produtos</summary><ul>@foreach($encomenda->linhas as $linha)<li>{{ $linha['nome'] }} · {{ $linha['quantidade'] }} × {{ number_format($linha['precoUnit'], 2, ',', ' ') }} €</li>@endforeach</ul></details></td></tr>
        @empty<tr><td colspan="5">Não há encomendas com estes filtros.</td></tr>@endforelse
    </tbody></table></div>{{ $encomendas->links() }}</section>
@endsection

@extends('layouts.admin')
@section('title', 'Utilizadores')
@section('content')
    <form class="filtros" method="GET">
        <label for="q">Nome ou email</label><input id="q" name="q" value="{{ request('q') }}" maxlength="100" type="search">
        <label for="papel">Papel</label><select id="papel" name="papel"><option value="">Todos</option>@foreach(['comprador', 'produtor', 'admin'] as $papel)<option @selected(request('papel') === $papel)>{{ $papel }}</option>@endforeach</select>
        <button class="botao" type="submit">Pesquisar</button>
    </form>
    <section class="cartao"><h2>{{ $utilizadores->total() }} utilizadores</h2>
        <div class="tabela"><table><thead><tr><th>Nome</th><th>Email</th><th>Papel</th><th>Registo</th></tr></thead><tbody>
            @forelse($utilizadores as $utilizador)<tr><td>{{ $utilizador->nome }}</td><td>{{ $utilizador->email }}</td><td><span class="selo">{{ $utilizador->papel }}</span></td><td>{{ $utilizador->createdAt?->format('d/m/Y H:i') }}</td></tr>@empty<tr><td colspan="4">Não há utilizadores com estes filtros.</td></tr>@endforelse
        </tbody></table></div>{{ $utilizadores->links() }}
    </section>
@endsection

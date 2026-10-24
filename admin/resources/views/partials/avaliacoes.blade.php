@forelse ($avaliacoes as $avaliacao)
    <article class="item" data-avaliacao="{{ $avaliacao->id }}">
        <h3>{{ $avaliacao->autorConta?->nome ?? 'Utilizador indisponível' }} → {{ $avaliacao->produtorConta?->nome ?? 'Produtor indisponível' }}</h3>
        <p class="comentario">{{ $avaliacao->comentario ?: 'Sem comentário.' }}</p>
        <p class="metadados">{{ $avaliacao->classificacao }}/5 · {{ $avaliacao->denuncias }} denúncias · {{ $avaliacao->visivel ? 'Visível' : 'Oculta' }} · {{ $avaliacao->createdAt?->format('d/m/Y H:i') }}</p>
        <form method="POST" action="{{ route('admin.moderacao.alterar', $avaliacao->id) }}" class="acoes">
            @csrf @method('PATCH')
            <button name="decisao" value="manter" class="botao secundario">Manter e resolver denúncias</button>
            @if($avaliacao->visivel)
                <button name="decisao" value="ocultar" class="botao perigo">Ocultar</button>
            @else
                <button name="decisao" value="repor" class="botao">Repor</button>
            @endif
        </form>
    </article>
@empty
    <p class="vazio">Não há avaliações nesta lista.</p>
@endforelse

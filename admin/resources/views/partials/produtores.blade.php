@forelse ($produtores as $produtor)
    <article class="item" data-produtor="{{ $produtor->id }}">
        <div class="linha"><div class="avatar" aria-hidden="true">{{ mb_strtoupper(mb_substr($produtor->nome, 0, 1)) }}</div><div>
            <h3>{{ data_get($produtor->produtor, 'nomeExploracao') ?: $produtor->nome }}</h3>
            <p class="metadados">{{ $produtor->nome }} · {{ $produtor->email }}</p>
            <p class="metadados">{{ data_get($produtor->produtor, 'localidade', 'Localidade não indicada') }} · {{ $produtor->createdAt?->format('d/m/Y') }}</p>
        </div><span class="selo">{{ $produtor->estado_produtor }}</span></div>
        @if(data_get($produtor->produtor, 'descricao'))<p>{{ data_get($produtor->produtor, 'descricao') }}</p>@endif
        @if($produtor->estado_produtor === 'Pendente')
            <form class="acoes" method="POST" action="{{ route('admin.produtores.validar', $produtor->id) }}">
                @csrf @method('PATCH')
                <button class="botao perigo-contorno" name="decisao" value="rejeitar" aria-label="Rejeitar produtor {{ $produtor->nome }}">Rejeitar</button>
                <button class="botao" name="decisao" value="aprovar" aria-label="Aprovar produtor {{ $produtor->nome }}">Aprovar</button>
            </form>
        @endif
    </article>
@empty
    <p class="vazio">Não há produtores nesta lista.</p>
@endforelse

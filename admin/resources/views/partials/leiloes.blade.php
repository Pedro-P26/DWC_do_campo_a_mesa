@forelse ($leiloes as $leilao)
    <article class="leilao item">
        <div class="titulo-secao"><h3>{{ $leilao->lote }}</h3><time class="contagem" datetime="{{ $leilao->terminaEm->toIso8601String() }}" data-termina="{{ $leilao->terminaEm->toIso8601String() }}">{{ $leilao->terminaEm->format('H:i:s') }}</time></div>
        <p class="metadados">{{ data_get($leilao->produtorConta?->produtor, 'nomeExploracao') ?: $leilao->produtorConta?->nome }}</p>
        <p><strong>{{ number_format(data_get($leilao->licitacaoAtual, 'valor', $leilao->precoBase), 2, ',', ' ') }} €</strong> <span class="metadados">· {{ $leilao->numLicitacoes ?? 0 }} licitações</span></p>
    </article>
@empty
    <p class="vazio">Não há leilões ativos.</p>
@endforelse

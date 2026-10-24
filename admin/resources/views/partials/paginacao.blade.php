@if ($paginator->hasPages())
    <nav class="paginacao" aria-label="Paginação">
        @if($paginator->onFirstPage())<span>Anterior</span>@else<a href="{{ $paginator->previousPageUrl() }}" rel="prev">Anterior</a>@endif
        <span>Página {{ $paginator->currentPage() }} de {{ $paginator->lastPage() }}</span>
        @if($paginator->hasMorePages())<a href="{{ $paginator->nextPageUrl() }}" rel="next">Seguinte</a>@else<span>Seguinte</span>@endif
    </nav>
@endif

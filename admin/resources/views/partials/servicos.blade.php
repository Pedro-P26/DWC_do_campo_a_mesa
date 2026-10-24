<div data-servicos-url="{{ route('admin.servicos.estado') }}">
    <dl class="servicos">
        @foreach(['api' => 'API REST', 'sockets' => 'Servidor de sockets', 'mongodb' => 'MongoDB', 'storage' => 'Armazenamento de imagens', 'swagger' => 'Swagger UI'] as $nome => $rotulo)
            <div><dt>{{ $rotulo }}</dt><dd data-servico="{{ $nome }}">A verificar…</dd></div>
        @endforeach
    </dl>
    <p class="metadados" data-servicos-atualizacao role="status">Verificação a cada 30 segundos.</p>
    <noscript><p>Ative o JavaScript para consultar o estado dos serviços.</p></noscript>
</div>

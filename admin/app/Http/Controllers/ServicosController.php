<?php

namespace App\Http\Controllers;

use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use MongoDB\Driver\Exception\Exception as MongoException;

class ServicosController extends Controller
{
    public function index()
    {
        return view('admin.servicos');
    }

    public function estado()
    {
        $api = config('administracao.api_url');
        $urls = ['api' => $api.'/api/health', 'sockets' => $api.'/socket.io/?EIO=4&transport=polling', 'swagger' => $api.'/api-docs/'];
        if ($storage = config('administracao.storage_health_url')) {
            $urls['storage'] = $storage;
        }
        $respostas = Http::pool(function (Pool $pool) use ($urls) {
            foreach ($urls as $nome => $url) {
                $pedido = $pool->as($nome)->connectTimeout(2)->timeout(3);
                $nome === 'storage' ? $pedido->head($url) : $pedido->get($url);
            }
        });
        $estados = [];
        foreach (['api' => 'API REST', 'sockets' => 'Servidor de sockets', 'swagger' => 'Swagger UI', 'storage' => 'Armazenamento de imagens'] as $nome => $rotulo) {
            $resposta = $respostas[$nome] ?? null;
            $ok = $resposta instanceof Response && $resposta->successful();
            if ($ok && $nome === 'api') {
                $ok = $resposta->json('estado') === 'ok';
            }
            if ($ok && $nome === 'sockets') {
                $ok = isset(json_decode(substr($resposta->body(), 1), true)['sid']);
            }
            $estados[$nome] = ['rotulo' => $rotulo, 'estado' => ! isset($urls[$nome]) ? 'Não configurado' : ($ok ? 'Operacional' : 'Indisponível')];
        }
        try {
            DB::connection('mongodb')->getMongoDB()->command(['ping' => 1]);
            $mongo = 'Operacional';
        } catch (MongoException) {
            $mongo = 'Indisponível';
        }
        $estados['mongodb'] = ['rotulo' => 'MongoDB', 'estado' => $mongo];

        return response()->json(['servicos' => $estados, 'atualizadoEm' => now()->toIso8601String()])->header('Cache-Control', 'no-store');
    }
}

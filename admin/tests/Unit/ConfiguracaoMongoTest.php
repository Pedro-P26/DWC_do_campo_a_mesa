<?php

namespace Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ConfiguracaoMongoTest extends TestCase
{
    public static function ligacoes(): array
    {
        return [
            'Atlas sem nome' => ['mongodb+srv://utilizador:password@cluster.exemplo.pt/?retryWrites=true', '', 'test'],
            'sem barra' => ['mongodb://localhost:27017', '', 'test'],
            'nome no URI' => ['mongodb://localhost:27017/do-campo-a-mesa?replicaSet=rs0', '', 'do-campo-a-mesa'],
            'replica set' => ['mongodb://host1:27017,host2:27017/mercado', '', 'mercado'],
            'nome explícito' => ['mongodb://localhost:27017/test', 'outra-base', 'outra-base'],
        ];
    }

    #[DataProvider('ligacoes')]
    public function test_seleciona_a_mesma_base_que_a_api(string $uri, string $explicita, string $esperada): void
    {
        $originalEnv = $_ENV;
        $originalServer = $_SERVER;
        foreach (['MONGODB_URI' => $uri, 'MONGODB_DATABASE' => $explicita] as $key => $value) {
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
        try {
            $config = require config_path('database.php');
            $this->assertSame($esperada, $config['connections']['mongodb']['database']);
            $this->assertSame($uri, $config['connections']['mongodb']['dsn']);
        } finally {
            $_ENV = $originalEnv;
            $_SERVER = $originalServer;
        }
    }
}

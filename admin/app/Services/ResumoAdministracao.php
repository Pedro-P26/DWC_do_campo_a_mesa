<?php

namespace App\Services;

use App\Models\Encomenda;
use App\Models\Leilao;
use App\Models\User;
use MongoDB\BSON\UTCDateTime;
use MongoDB\Collection;

class ResumoAdministracao
{
    public function indicadores(): array
    {
        $hoje = now()->startOfDay();
        $amanha = $hoje->copy()->addDay();
        $pedidos = Encomenda::raw(fn (Collection $collection) => $collection->aggregate([
            ['$match' => ['createdAt' => ['$gte' => new UTCDateTime($hoje), '$lt' => new UTCDateTime($amanha)]]],
            ['$group' => [
                '_id' => null,
                'quantidade' => ['$sum' => 1],
                'valor' => ['$sum' => ['$round' => [['$sum' => ['$map' => [
                    'input' => '$linhas', 'as' => 'linha',
                    'in' => ['$multiply' => ['$$linha.precoUnit', '$$linha.quantidade']],
                ]]], 2]]],
            ]],
        ])->toArray());

        return [
            'utilizadores' => User::count(),
            'utilizadoresSemana' => User::where('createdAt', '>=', $hoje->copy()->subDays(6))->where('createdAt', '<', $amanha)->count(),
            'produtores' => User::where('papel', 'produtor')->where('produtor.validado', true)->count(),
            'produtoresPendentes' => User::pendentes()->count(),
            'encomendasHoje' => (int) ($pedidos[0]['quantidade'] ?? 0),
            'valorEncomendasHoje' => round((float) ($pedidos[0]['valor'] ?? 0), 2),
            'leiloesAtivos' => $this->leiloesAtivos()->count(),
        ];
    }

    public function leiloesAtivos()
    {
        return Leilao::where('estado', 'ativo')->where('terminaEm', '>', now());
    }
}

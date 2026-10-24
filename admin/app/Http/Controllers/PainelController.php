<?php

namespace App\Http\Controllers;

use App\Models\Avaliacao;
use App\Models\User;
use App\Services\ResumoAdministracao;

class PainelController extends Controller
{
    public function __invoke(ResumoAdministracao $resumo)
    {
        return view('admin.inicio', [
            'indicadores' => $resumo->indicadores(),
            'produtores' => User::pendentes()->orderBy('createdAt')->limit(5)->get(),
            'avaliacoes' => Avaliacao::with(['autorConta', 'produtorConta'])->where('denuncias', '>', 0)->orderByDesc('createdAt')->limit(5)->get(),
            'leiloes' => $resumo->leiloesAtivos()->with('produtorConta')->orderBy('terminaEm')->limit(6)->get(),
        ]);
    }

    public function estado(ResumoAdministracao $resumo)
    {
        return response()->json([
            'indicadores' => $resumo->indicadores(),
            'leiloes' => view('partials.leiloes', [
                'leiloes' => $resumo->leiloesAtivos()->with('produtorConta')->orderBy('terminaEm')->limit(6)->get(),
            ])->render(),
            'atualizadoEm' => now()->toIso8601String(),
        ])->header('Cache-Control', 'no-store');
    }
}

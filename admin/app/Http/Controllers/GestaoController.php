<?php

namespace App\Http\Controllers;

use App\Models\Avaliacao;
use App\Models\Encomenda;
use App\Models\Leilao;
use App\Models\User;
use App\Services\ResumoAdministracao;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GestaoController extends Controller
{
    public function produtores(Request $request)
    {
        $filtros = $request->validate(['estado' => ['nullable', Rule::in(['pendentes', 'aprovados', 'rejeitados', 'todos'])]]);
        $estado = $filtros['estado'] ?? 'pendentes';
        $query = User::where('papel', 'produtor');
        match ($estado) {
            'pendentes' => $query->pendentes(),
            'aprovados' => $query->where('produtor.validado', true),
            'rejeitados' => $query->where('produtor.rejeitado', true)->where('produtor.validado', false),
            default => null,
        };

        return view('admin.produtores', ['estado' => $estado, 'produtores' => $query->orderBy('createdAt')->paginate(20)->withQueryString()]);
    }

    public function validarProdutor(Request $request, string $id)
    {
        $dados = $request->validate(['decisao' => ['required', Rule::in(['aprovar', 'rejeitar'])]]);
        abort_unless(User::where('papel', 'produtor')->find($id), 404);
        $aprovado = $dados['decisao'] === 'aprovar';
        // Só o primeiro administrador a decidir altera o pedido pendente.
        $alterados = User::pendentes()->where('id', $id)->update([
            'produtor.validado' => $aprovado, 'produtor.rejeitado' => ! $aprovado,
        ]);

        return back()->with('mensagem', $alterados ? ($aprovado ? 'Produtor aprovado.' : 'Produtor rejeitado.') : 'Este pedido já foi decidido. Atualize a lista.');
    }

    public function moderacao(Request $request)
    {
        $dados = $request->validate(['estado' => ['nullable', Rule::in(['denunciadas', 'ocultas', 'todas'])]]);
        $estado = $dados['estado'] ?? 'denunciadas';
        $query = Avaliacao::with(['autorConta', 'produtorConta']);
        if ($estado === 'denunciadas') {
            $query->where('denuncias', '>', 0);
        } elseif ($estado === 'ocultas') {
            $query->where('visivel', false);
        }

        return view('admin.moderacao', ['estado' => $estado, 'avaliacoes' => $query->orderByDesc('createdAt')->paginate(20)->withQueryString()]);
    }

    public function moderar(Request $request, string $id)
    {
        $dados = $request->validate(['decisao' => ['required', Rule::in(['manter', 'ocultar', 'repor'])]]);
        abort_unless(Avaliacao::find($id), 404);
        $campos = ['visivel' => $dados['decisao'] !== 'ocultar'];
        if ($dados['decisao'] === 'manter') {
            $campos['denuncias'] = 0;
            $campos['denunciantes'] = [];
        }
        Avaliacao::where('id', $id)->update($campos);

        return back()->with('mensagem', match ($dados['decisao']) {
            'manter' => 'Avaliação mantida e denúncias resolvidas.',
            'ocultar' => 'Avaliação ocultada. As denúncias foram preservadas.',
            'repor' => 'Avaliação reposta.',
        });
    }

    public function utilizadores(Request $request)
    {
        $dados = $request->validate(['q' => 'nullable|string|max:100', 'papel' => ['nullable', Rule::in(['comprador', 'produtor', 'admin'])]]);
        $query = User::query();
        if ($q = trim($dados['q'] ?? '')) {
            $query->where(fn ($query) => $query->where('nome', 'like', '%'.$q.'%')->orWhere('email', 'like', '%'.$q.'%'));
        }
        if ($papel = $dados['papel'] ?? null) {
            $query->where('papel', $papel);
        }

        return view('admin.utilizadores', ['utilizadores' => $query->orderByDesc('createdAt')->paginate(20)->withQueryString()]);
    }

    public function encomendas(Request $request)
    {
        $dados = $request->validate(['estado' => ['nullable', Rule::in(['pendente', 'confirmada', 'pronta', 'entregue'])]]);
        $query = Encomenda::with(['compradorConta', 'produtorConta']);
        if ($estado = $dados['estado'] ?? null) {
            $query->where('estado', $estado);
        }

        return view('admin.encomendas', ['encomendas' => $query->orderByDesc('createdAt')->paginate(20)->withQueryString()]);
    }

    public function leiloes(Request $request, ResumoAdministracao $resumo)
    {
        $dados = $request->validate(['estado' => ['nullable', Rule::in(['agendado', 'ativo', 'terminado'])]]);
        $query = Leilao::with('produtorConta');
        if ($estado = $dados['estado'] ?? null) {
            $query->where('estado', $estado);
        }

        return view('admin.leiloes', [
            'historico' => $query->orderByDesc('terminaEm')->paginate(20)->withQueryString(),
            'leiloes' => $resumo->leiloesAtivos()->with('produtorConta')->orderBy('terminaEm')->limit(6)->get(),
        ]);
    }
}

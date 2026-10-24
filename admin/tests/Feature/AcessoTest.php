<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\TestCase;

class AcessoTest extends TestCase
{
    public function test_todas_as_rotas_de_gestao_exigem_sessao(): void
    {
        foreach (['/', '/painel/estado', '/produtores', '/moderacao', '/utilizadores', '/encomendas', '/leiloes', '/servicos', '/servicos/estado'] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
        $this->patchJson('/produtores/012345678901234567890123/validacao', ['decisao' => 'aprovar'])->assertUnauthorized();
        $this->patchJson('/moderacao/012345678901234567890123', ['decisao' => 'ocultar'])->assertUnauthorized();
    }

    public function test_compradores_e_produtores_nao_podem_abrir_o_backoffice(): void
    {
        foreach (['comprador', 'produtor'] as $papel) {
            $conta = (new User)->forceFill(['id' => '012345678901234567890123', 'papel' => $papel, 'nome' => 'Teste']);
            $this->actingAs($conta)->get('/')->assertForbidden();
            $this->patchJson('/moderacao/012345678901234567890123', ['decisao' => 'ocultar'])->assertForbidden();
        }
    }
}

<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ResumoAdministracao;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use MongoDB\BSON\ObjectId;
use MongoDB\BSON\UTCDateTime;
use Tests\TestCase;

class MongoAdministracaoTest extends TestCase
{
    private $mongo;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        if (getenv('ADMIN_MONGO_TESTS') !== '1') {
            $this->markTestSkipped('Executar composer test:mongodb para testar com um MongoDB temporário.');
        }
        $nome = config('database.connections.mongodb.database');
        if (! preg_match('/^dcm_admin_test_[a-f0-9]{16}$/', $nome)) {
            throw new \RuntimeException('Os testes só podem usar uma base de dados temporária isolada.');
        }
        $this->mongo = DB::connection('mongodb')->getMongoDB();
        foreach (['users', 'orders', 'reviews', 'auctions'] as $colecao) {
            $this->mongo->selectCollection($colecao)->deleteMany([]);
        }
        $id = $this->conta('Administrador', 'admin');
        $this->admin = User::findOrFail((string) $id);
    }

    private function conta(string $nome, string $papel = 'produtor', array $extra = []): ObjectId
    {
        return $this->inserir('users', array_replace([
            'nome' => $nome, 'email' => mb_strtolower($nome).'@teste.pt', 'papel' => $papel,
            'passwordHash' => getenv('ADMIN_TEST_BCRYPT_HASH'), 'produtor' => ['validado' => false],
        ], $extra));
    }

    private function inserir(string $colecao, array $dados): ObjectId
    {
        $id = new ObjectId;
        $this->mongo->selectCollection($colecao)->insertOne(array_merge([
            '_id' => $id, 'createdAt' => new UTCDateTime(now()), 'updatedAt' => new UTCDateTime(now()),
        ], $dados));

        return $id;
    }

    public function test_login_com_hash_bcryptjs_e_logout_sem_reescrever_a_password(): void
    {
        $this->post('/login', ['email' => ' ADMINISTRADOR@teste.pt ', 'password' => 'password123'])->assertRedirect('/');
        $this->assertAuthenticatedAs($this->admin);
        $this->assertSame(getenv('ADMIN_TEST_BCRYPT_HASH'), User::find($this->admin->id)->passwordHash);
        $this->get('/')->assertOk()->assertSee('Visão geral');
        $this->post('/logout')->assertRedirect('/login');
        $this->assertGuest();
        $this->get('/')->assertRedirect('/login');
    }

    public function test_login_recusa_password_errada_e_papeis_sem_acesso(): void
    {
        $this->conta('Comprador', 'comprador');
        $this->conta('Produtor', 'produtor');
        foreach ([['administrador@teste.pt', 'incorreta'], ['comprador@teste.pt', 'password123'], ['produtor@teste.pt', 'password123']] as [$email, $password]) {
            $this->postJson('/login', compact('email', 'password'))->assertUnprocessable()->assertJsonValidationErrors('email');
            $this->assertGuest();
        }
    }

    public function test_limita_tentativas_de_login(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/login', ['email' => 'inexistente@teste.pt', 'password' => 'incorreta'])->assertUnprocessable();
        }
        $this->postJson('/login', ['email' => 'inexistente@teste.pt', 'password' => 'incorreta'])->assertTooManyRequests();
    }

    public function test_aprovar_e_rejeitar_persistem_campos_mongoose_e_impedem_decisoes_concorrentes(): void
    {
        $pendente = $this->conta('Pendente', extra: ['produtor' => ['validado' => false, 'descricao' => 'Manter descrição']]);
        $rejeitar = $this->conta('Rejeitar');
        $this->actingAs($this->admin)->get('/produtores')->assertOk()->assertSee('Pendente')->assertSee('Rejeitar');
        $this->patch('/produtores/'.$pendente.'/validacao', ['decisao' => 'aprovar', 'papel' => 'admin'])->assertRedirect();
        $doc = $this->mongo->users->findOne(['_id' => $pendente]);
        $this->assertTrue($doc['produtor']['validado']);
        $this->assertFalse($doc['produtor']['rejeitado']);
        $this->assertSame('Manter descrição', $doc['produtor']['descricao']);
        $this->assertSame('produtor', $doc['papel']);
        $this->assertInstanceOf(UTCDateTime::class, $doc['updatedAt']);
        $this->assertArrayNotHasKey('updated_at', $doc);
        $this->patch('/produtores/'.$pendente.'/validacao', ['decisao' => 'rejeitar'])->assertSessionHas('mensagem', 'Este pedido já foi decidido. Atualize a lista.');
        $this->assertTrue($this->mongo->users->findOne(['_id' => $pendente])['produtor']['validado']);
        $this->patch('/produtores/'.$rejeitar.'/validacao', ['decisao' => 'rejeitar'])->assertRedirect();
        $this->assertTrue($this->mongo->users->findOne(['_id' => $rejeitar])['produtor']['rejeitado']);
        $this->get('/produtores')->assertDontSee('Pendente@teste.pt', false);
        $this->get('/produtores?estado=aprovados')->assertSee('Pendente');
        $this->get('/produtores?estado=rejeitados')->assertSee('Rejeitar');
        $this->patchJson('/produtores/'.$rejeitar.'/validacao', ['decisao' => 'invalidar'])->assertUnprocessable();
        $this->patchJson('/produtores/'.$this->admin->id.'/validacao', ['decisao' => 'aprovar'])->assertNotFound();
        $this->patchJson('/produtores/invalido/validacao', ['decisao' => 'aprovar'])->assertNotFound();
    }

    public function test_moderacao_oculta_repoe_e_resolve_denuncias_sem_apagar_o_documento(): void
    {
        $produtor = $this->conta('Horta');
        $id = $this->inserir('reviews', ['autor' => new ObjectId($this->admin->id), 'produtor' => $produtor, 'encomenda' => new ObjectId,
            'comentario' => '<script>alert(1)</script>', 'classificacao' => 3, 'denuncias' => 2, 'visivel' => true]);
        $this->actingAs($this->admin)->get('/moderacao')->assertOk()->assertSee('&lt;script&gt;', false)->assertDontSee('<script>alert(1)</script>', false)->assertSee('Horta');
        $this->patch('/moderacao/'.$id, ['decisao' => 'ocultar'])->assertRedirect();
        $doc = $this->mongo->reviews->findOne(['_id' => $id]);
        $this->assertFalse($doc['visivel']);
        $this->assertSame(2, $doc['denuncias']);
        $this->patch('/moderacao/'.$id, ['decisao' => 'repor'])->assertRedirect();
        $this->assertTrue($this->mongo->reviews->findOne(['_id' => $id])['visivel']);
        $this->patch('/moderacao/'.$id, ['decisao' => 'manter'])->assertRedirect();
        $this->assertSame(0, $this->mongo->reviews->findOne(['_id' => $id])['denuncias']);
        $this->get('/moderacao')->assertDontSee('&lt;script&gt;', false);
        $this->patchJson('/moderacao/'.new ObjectId, ['decisao' => 'ocultar'])->assertNotFound();
    }

    public function test_estatisticas_respeitam_o_dia_de_lisboa_e_totais_monetarios(): void
    {
        $this->travelTo(new \DateTimeImmutable('2026-10-25T12:00:00+00:00'));
        $produtor = $this->conta('Aprovado', extra: ['produtor' => ['validado' => true]]);
        $hoje = now()->startOfDay();
        $amanha = $hoje->copy()->addDay();
        foreach ([[$hoje, 2.4, 3], [$amanha->copy()->subMillisecond(), 3.6, 2], [$hoje->copy()->subMillisecond(), 100, 1], [$amanha, 100, 1]] as [$data, $preco, $quantidade]) {
            $this->inserir('orders', ['comprador' => new ObjectId($this->admin->id), 'produtor' => $produtor, 'createdAt' => new UTCDateTime($data),
                'estado' => 'pendente', 'linhas' => [['nome' => 'Kiwi', 'precoUnit' => $preco, 'quantidade' => $quantidade]]]);
        }
        $this->inserir('auctions', ['produtor' => $produtor, 'lote' => 'Leilão ativo', 'estado' => 'ativo', 'precoBase' => 10, 'terminaEm' => new UTCDateTime(now()->addHour())]);
        $this->inserir('auctions', ['produtor' => $produtor, 'lote' => 'Já expirado', 'estado' => 'ativo', 'terminaEm' => new UTCDateTime(now()->subMinute())]);
        $resumo = app(ResumoAdministracao::class)->indicadores();
        $this->assertSame(2, $resumo['encomendasHoje']);
        $this->assertSame(14.4, $resumo['valorEncomendasHoje']);
        $this->assertSame(1, $resumo['leiloesAtivos']);
        $resposta = $this->actingAs($this->admin)->getJson('/painel/estado')->assertOk()->assertJsonPath('indicadores.encomendasHoje', 2);
        $this->assertStringContainsString('Leilão ativo', $resposta->json('leiloes'));
        $this->assertStringNotContainsString('Já expirado', $resposta->json('leiloes'));
    }

    public function test_listas_filtram_e_paginam_sem_expor_passwords(): void
    {
        for ($i = 0; $i < 24; $i++) {
            $this->conta('Pessoa'.$i, 'comprador');
        }
        $this->actingAs($this->admin)->get('/utilizadores')->assertOk()->assertSee('Página 1 de 2')->assertDontSee(getenv('ADMIN_TEST_BCRYPT_HASH'), false);
        $this->get('/utilizadores?q=Pessoa23&papel=comprador')->assertOk()->assertSee('Pessoa23')->assertDontSee('Pessoa22');
        $this->get('/encomendas')->assertOk();
        $this->get('/leiloes')->assertOk();
        $this->getJson('/encomendas?estado=invalido')->assertUnprocessable();
    }

    public function test_servicos_refletem_as_respostas_observadas(): void
    {
        Http::fake([
            '*/api/health' => Http::response(['estado' => 'ok']),
            '*/socket.io/*' => Http::response('0{"sid":"teste"}'),
            '*/api-docs/' => Http::response('Erro', 503),
        ]);
        $this->actingAs($this->admin)->getJson('/servicos/estado')->assertOk()
            ->assertJsonPath('servicos.api.estado', 'Operacional')
            ->assertJsonPath('servicos.sockets.estado', 'Operacional')
            ->assertJsonPath('servicos.swagger.estado', 'Indisponível')
            ->assertJsonPath('servicos.storage.estado', 'Não configurado')
            ->assertJsonPath('servicos.mongodb.estado', 'Operacional');
    }

    public function test_falhas_de_rede_nao_marcam_servicos_como_operacionais(): void
    {
        Http::fake(fn () => Http::failedConnection());
        $this->actingAs($this->admin)->getJson('/servicos/estado')->assertOk()
            ->assertJsonPath('servicos.api.estado', 'Indisponível')
            ->assertJsonPath('servicos.sockets.estado', 'Indisponível');
    }

    public function test_indisponibilidade_do_mongo_devolve_503_sem_expor_a_ligacao(): void
    {
        config(['database.connections.mongodb.dsn' => 'mongodb://127.0.0.1:1', 'database.connections.mongodb.options.serverSelectionTimeoutMS' => 100]);
        DB::purge('mongodb');
        $this->post('/login', ['email' => 'administrador@teste.pt', 'password' => 'password123'])
            ->assertStatus(503)->assertSee('Não foi possível contactar o MongoDB')->assertDontSee('mongodb://');
    }
}

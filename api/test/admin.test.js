const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const Review = require('../src/models/Review');
const Auction = require('../src/models/Auction');
const periodosEstatisticas = require('../src/utils/periodosEstatisticas');

test('Períodos de Lisboa respeitam o dia local e as mudanças de hora', () => {
  for (const [agora, hoje, amanha, inicioSemana] of [
    ['2026-07-15T23:30:00Z', '2026-07-15T23:00:00Z', '2026-07-16T23:00:00Z', '2026-07-09T23:00:00Z'],
    ['2026-03-29T12:00:00Z', '2026-03-29T00:00:00Z', '2026-03-29T23:00:00Z', '2026-03-23T00:00:00Z'],
    ['2026-10-25T12:00:00Z', '2026-10-24T23:00:00Z', '2026-10-26T00:00:00Z', '2026-10-18T23:00:00Z'],
    ['2026-01-01T12:00:00Z', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '2025-12-26T00:00:00Z']
  ]) {
    assert.deepEqual(periodosEstatisticas(new Date(agora)), {
      hoje: new Date(hoje), amanha: new Date(amanha), inicioSemana: new Date(inicioSemana)
    });
  }
});

test('Administração: estatísticas, validação e moderação com persistência', async (t) => {
  const secretAnterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'segredo-admin-apenas-para-testes';
  let mongo, server;
  try {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    const app = express();
    app.use(express.json());
    app.use('/admin', require('../src/routes/admin'));
    app.use(require('../src/middleware/errorHandler'));
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/admin`;
    const token = jwt.sign({ id: new mongoose.Types.ObjectId().toString(), papel: 'admin' }, process.env.JWT_SECRET);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const get = caminho => fetch(`${base}${caminho}`, { headers });
    const patch = (caminho, corpo) => fetch(`${base}${caminho}`, { method: 'PATCH', headers, body: JSON.stringify(corpo) });

    await t.test('Exige autenticação e papel de administrador', async () => {
      assert.equal((await fetch(`${base}/estatisticas`)).status, 401);
      const comprador = jwt.sign({ papel: 'comprador' }, process.env.JWT_SECRET);
      assert.equal((await fetch(`${base}/estatisticas`, { headers: { Authorization: `Bearer ${comprador}` } })).status, 403);
    });
    await t.test('Sem dados devolve zeros, incluindo o valor das encomendas', async () => {
      assert.deepEqual(await (await get('/estatisticas')).json(), {
        utilizadores: 0, utilizadoresSemana: 0, produtores: 0, produtoresPendentes: 0,
        encomendasHoje: 0, valorEncomendasHoje: 0, leiloesAtivos: 0
      });
    });
    const { hoje, amanha, inicioSemana } = periodosEstatisticas();
    const conta = (nome, extra = {}) => ({ nome, email: `${nome}@teste.pt`, passwordHash: 'hash-teste', papel: 'produtor', ...extra });
    const [ativo, pendente, rejeitado] = await User.create([
      conta('ativo', { produtor: { validado: true }, createdAt: new Date(inicioSemana.getTime() - 1) }),
      conta('pendente', { createdAt: inicioSemana }),
      conta('rejeitado', { produtor: { rejeitado: true }, createdAt: hoje })
    ]);
    // Simula uma conta antiga sem o novo campo.
    await User.collection.updateOne({ _id: pendente._id }, { $unset: { 'produtor.rejeitado': '' } });
    const encomenda = (createdAt, linhas) => ({ comprador: pendente._id, produtor: ativo._id, createdAt,
      linhas: linhas.map(([precoUnit, quantidade]) => ({ nome: 'Produto', precoUnit, quantidade })) });
    const [pedido] = await Order.create([
      encomenda(hoje, [[2.4, 3], [0.1, 2]]), encomenda(new Date(amanha.getTime() - 1), [[3.5, 2]]),
      encomenda(new Date(hoje.getTime() - 1), [[99, 1]]), encomenda(amanha, [[99, 1]])
    ]);
    await Auction.create(['ativo', 'agendado', 'terminado'].map(estado => ({
      produtor: ativo._id, lote: estado, estado, precoBase: 1, incremento: 1, iniciaEm: hoje, terminaEm: amanha
    })));
    await t.test('Conta só aprovados, inclui pendentes antigos e soma apenas encomendas de hoje', async () => {
      assert.deepEqual(await (await get('/estatisticas')).json(), {
        utilizadores: 3, utilizadoresSemana: 2, produtores: 1, produtoresPendentes: 1,
        encomendasHoje: 2, valorEncomendasHoje: 14.4, leiloesAtivos: 1
      });
      const lista = await (await get('/produtores/pendentes')).json();
      assert.deepEqual(lista.map(p => p._id), [String(pendente._id)]);
      assert.equal(lista[0].createdAt, inicioSemana.toISOString());
    });
    await t.test('Rejeitar persiste e retira o produtor da lista e do contador de pendentes', async () => {
      assert.equal((await patch(`/produtores/${pendente._id}/validacao`, { aprovado: false })).status, 200);
      const guardado = await User.findById(pendente._id);
      assert.equal(guardado.produtor.validado, false);
      assert.equal(guardado.produtor.rejeitado, true);
      assert.deepEqual(await (await get('/produtores/pendentes')).json(), []);
      assert.equal((await (await get('/estatisticas')).json()).produtoresPendentes, 0);
    });
    await t.test('Aprovar limpa a rejeição e incrementa os produtores ativos', async () => {
      assert.equal((await patch(`/produtores/${rejeitado._id}/validacao`, { aprovado: true })).status, 200);
      const guardado = await User.findById(rejeitado._id);
      assert.equal(guardado.produtor.validado, true);
      assert.equal(guardado.produtor.rejeitado, false);
      assert.equal((await (await get('/estatisticas')).json()).produtores, 2);
      assert.equal((await patch(`/produtores/${rejeitado._id}/validacao`, { aprovado: 'false' })).status, 400);
      assert.equal((await patch(`/produtores/${new mongoose.Types.ObjectId()}/validacao`, { aprovado: true })).status, 404);
    });
    await t.test('Ocultar e repor preservam denúncias; manter resolve-as sem ocultar', async () => {
      const review = await Review.create({ autor: pendente._id, produtor: ativo._id, encomenda: pedido._id,
        classificacao: 4, comentario: 'Comentário de teste', denuncias: 3 });
      const caminho = `/reviews/${review._id}`;
      assert.equal((await patch(caminho, { visivel: false })).status, 200);
      assert.equal((await Review.findById(review._id)).visivel, false);
      assert.equal((await (await get('/reviews/denunciadas')).json()).length, 1);
      await patch(caminho, { visivel: true });
      assert.equal((await Review.findById(review._id)).denuncias, 3);
      assert.equal((await patch(caminho, { visivel: true, resolverDenuncias: 'true' })).status, 400);
      assert.equal((await patch(caminho, { visivel: true, resolverDenuncias: true })).status, 200);
      const guardada = await Review.findById(review._id);
      assert.equal(guardada.visivel, true);
      assert.equal(guardada.denuncias, 0);
      assert.deepEqual(await (await get('/reviews/denunciadas')).json(), []);
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    await mongo?.stop();
    if (secretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretAnterior;
  }
});

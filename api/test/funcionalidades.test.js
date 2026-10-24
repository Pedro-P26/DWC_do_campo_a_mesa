// Integração em replica set descartável. Não lê .env nem altera a base partilhada.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Review = require('../src/models/Review');
const Auction = require('../src/models/Auction');
const Bid = require('../src/models/Bid');
const { licitar, ciclo } = require('../src/services/tempoReal');

test('Catálogo, perfil, avaliações e consistência com persistência real', async t => {
  const anterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'apenas-integracao-base-descartavel';
  let mongo, server, pararValidacao;
  try {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await Promise.all([User, Product, Order, Review, Auction, Bid].map(M => M.init()));
    const conta = (nome, papel, produtor) => ({ nome, papel, produtor, email: `${nome}@teste.pt`, passwordHash: 'hash-descartavel' });
    const [horta, mel, ana, joao] = await User.create([
      conta('Horta', 'produtor', { nomeExploracao: 'Quinta Verde', localidade: 'Ponte de Lima', validado: true }),
      conta('Mel', 'produtor', { nomeExploracao: 'Apiário', localidade: 'Caminha', validado: true }),
      conta('Ana', 'comprador'), conta('Joao', 'comprador')
    ]);
    const [pao, frasco] = await Product.create([
      { produtor: horta.id, nome: 'Pão caseiro', ingredientes: ['Farinha de milho', 'Água'], categoria: 'Padaria', preco: 2, stock: 5 },
      { produtor: mel.id, nome: 'Mel puro', categoria: 'Mel', preco: 5, stock: 1 }
    ]);
    const eventos = [];
    const io = { to: sala => ({ emit: (nome, dados) => eventos.push({ sala, nome, dados }) }) };
    pararValidacao = await require('../src/services/validacaoProdutores')(io);
    const app = require('../src/app'); app.set('io', io);
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const token = conta => jwt.sign({ id: conta.id, nome: conta.nome, papel: conta.papel }, process.env.JWT_SECRET);
    const pedir = (rota, metodo = 'GET', corpo, conta) => fetch(`${base}${rota}`, { method: metodo,
      headers: { 'Content-Type': 'application/json', ...(conta ? { Authorization: `Bearer ${token(conta)}` } : {}) },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }) });

    await t.test('Pesquisa nome, ingrediente, exploração e localidade com filtros combinados e regex literal', async () => {
      for (const query of ['q=milho', 'q=Quinta', 'q=Horta&localidade=Lima', `produtor=${horta.id}&localidade=Lima&categoria=Padaria`]) {
        const r = await pedir(`/products?${query}`); assert.equal(r.status, 200);
        assert.deepEqual((await r.json()).map(p => p._id), [pao.id]);
      }
      for (const query of [`produtor=${horta.id}&localidade=Caminha`, 'q=.*', 'q=milho&categoria=Mel']) assert.deepEqual(await (await pedir(`/products?${query}`)).json(), []);
      assert.equal((await pedir('/products?localidade[x]=a')).status, 400);
    });
    await t.test('Página pública: só o próprio produtor edita; campos administrativos preservados', async () => {
      assert.equal((await pedir('/producers/me', 'PATCH', { localidade: 'Porto' })).status, 401);
      assert.equal((await pedir('/producers/me', 'PATCH', { localidade: 'Porto' }, ana)).status, 403);
      const r = await pedir('/producers/me', 'PATCH', { nomeExploracao: 'Quinta renovada', descricao: 'Produção local.', localidade: 'Viana',
        localizacao: { lat: 41.69, lng: -8.83 }, validado: false, papel: 'admin', id: mel.id }, horta);
      assert.equal(r.status, 200);
      const dados = await r.json(); assert.equal(dados.passwordHash, undefined); assert.equal(dados.produtor.validado, true); assert.equal(dados.papel, 'produtor');
      const publico = await (await pedir(`/producers/${horta.id}`)).json();
      assert.deepEqual(publico.produtor.produtor.localizacao, { lat: 41.69, lng: -8.83 });
      assert.equal((await User.findById(mel.id)).produtor.localidade, 'Caminha');
      for (const localizacao of [{ lat: 91, lng: 0 }, { lat: 0 }, { lat: '1', lng: 1 }, []]) assert.equal((await pedir('/producers/me', 'PATCH', { localizacao }, horta)).status, 400);
      assert.equal((await pedir('/producers/me', 'PATCH', { localidade: ' ' }, horta)).status, 400);
      assert.equal((await pedir('/producers/me', 'PATCH', { localizacao: null }, horta)).status, 200);
      assert.equal((await User.findById(horta.id).lean()).produtor.localizacao, null);
    });
    await t.test('Avaliações separadas do produtor/produto, só após entrega e sem duplicação', async () => {
      const pedido = await Order.create({ comprador: ana.id, produtor: horta.id, estado: 'pendente', linhas: [{ produto: pao.id, nome: pao.nome, quantidade: 1, precoUnit: pao.preco }] });
      const corpo = { encomenda: pedido.id, classificacao: 5, comentario: 'Excelente milho.' };
      assert.equal((await pedir('/reviews', 'POST', corpo, ana)).status, 404);
      await Order.updateOne({ _id: pedido.id }, { estado: 'entregue' });
      assert.equal((await pedir('/reviews', 'POST', corpo, joao)).status, 404);
      assert.equal((await pedir('/reviews', 'POST', { ...corpo, produto: frasco.id }, ana)).status, 404);
      assert.equal((await pedir('/reviews', 'POST', corpo, ana)).status, 201);
      assert.equal((await pedir('/reviews', 'POST', { ...corpo, produto: pao.id }, ana)).status, 201);
      assert.equal((await pedir('/reviews', 'POST', { ...corpo, produto: pao.id }, ana)).status, 409);
      const lista = await (await pedir(`/reviews?produto=${pao.id}`)).json(); assert.equal(lista.length, 1); assert.equal(lista[0].autor.nome, ana.nome);
      await Review.updateOne({ produto: pao.id }, { visivel: false });
      assert.deepEqual(await (await pedir(`/reviews?produto=${pao.id}`)).json(), []);
    });
    await t.test('Aprovação escrita diretamente no MongoDB notifica apenas o produtor aprovado', async () => {
      await User.collection.updateOne({ _id: horta._id }, { $set: { 'produtor.validado': false } });
      await User.collection.updateOne({ _id: horta._id }, { $set: { 'produtor.validado': true } });
      const limite = Date.now() + 5000;
      while (!eventos.some(e => e.nome === 'conta-validada') && Date.now() < limite) await new Promise(r => setTimeout(r, 25));
      assert.deepEqual(eventos.filter(e => e.nome === 'conta-validada'), [{ sala: `user:${horta.id}`, nome: 'conta-validada', dados: { id: horta.id } }]);
    });
    const user = u => ({ id: u.id, nome: u.nome, papel: u.papel });
    const leilao = await Auction.create({ produtor: horta.id, lote: 'Lote concorrente', precoBase: 100, incremento: 5,
      licitacaoAtual: { valor: 100 }, iniciaEm: new Date(Date.now() - 60000), terminaEm: new Date(Date.now() + 600000), estado: 'ativo' });
    await t.test('Duas licitações iguais aceitam só uma; valor mínimo e papéis são respeitados', async () => {
      const respostas = await Promise.allSettled([licitar(leilao.id, 105, user(ana)), licitar(leilao.id, 105, user(joao))]);
      assert.equal(respostas.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(respostas.find(r => r.status === 'rejected').reason.status, 409);
      assert.equal(await Bid.countDocuments({ leilao: leilao.id }), 1);
      await assert.rejects(licitar(leilao.id, 109, user(ana)), { status: 409 });
      await assert.rejects(licitar(leilao.id, 110, user(horta)), { status: 403 });
    });
    await t.test('Rajada de propostas mantém histórico e valor final coerentes', async () => {
      const rajada = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => licitar(leilao.id, 110 + i * 5, user(i % 2 ? ana : joao))));
      const bids = await Bid.find({ leilao: leilao.id }).sort({ valor: 1 });
      assert.equal(bids.length, 1 + rajada.filter(r => r.status === 'fulfilled').length);
      for (let i = 1; i < bids.length; i++) assert(bids[i].valor >= bids[i - 1].valor + 5);
      const atual = await Auction.findById(leilao.id); assert.equal(atual.licitacaoAtual.valor, bids.at(-1).valor); assert.equal(atual.numLicitacoes, bids.length);
    });
    await t.test('Leilão expirado recusa propostas e fecho repetido cria só uma encomenda', async () => {
      await Auction.updateOne({ _id: leilao.id }, { terminaEm: new Date(Date.now() - 1000) });
      await assert.rejects(licitar(leilao.id, 1000, user(ana)), { status: 409 });
      await Promise.all([ciclo(io), ciclo(io)]); await ciclo(io);
      assert.equal(await Order.countDocuments({ leilao: leilao.id }), 1);
      assert.equal((await Auction.findById(leilao.id)).estado, 'terminado');
    });
    await t.test('Compras concorrentes não vendem acima do stock', async () => {
      const corpo = { linhas: [{ produto: frasco.id, quantidade: 1 }] };
      const rs = await Promise.all([pedir('/orders', 'POST', corpo, ana), pedir('/orders', 'POST', corpo, joao)]);
      assert.deepEqual(rs.map(r => r.status).sort(), [201, 409]);
      assert.equal((await Product.findById(frasco.id)).stock, 0);
    });
    await t.test('Falha numa linha repõe reservas sem encomenda parcial', async () => {
      const antes = await Order.countDocuments(), stock = (await Product.findById(pao.id)).stock;
      const r = await pedir('/orders', 'POST', { linhas: [{ produto: pao.id, quantidade: 1 }, { produto: new mongoose.Types.ObjectId().toString(), quantidade: 1 }] }, ana);
      assert.equal(r.status, 409); assert.equal(await Order.countDocuments(), antes); assert.equal((await Product.findById(pao.id)).stock, stock);
    });
  } finally {
    await pararValidacao?.();
    if (server) await new Promise(r => server.close(r));
    await mongoose.disconnect(); await mongo?.stop();
    if (anterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = anterior;
  }
});

// Base temporária: nunca lê .env nem escreve no cluster partilhado.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Order = require('../src/models/Order');
const Review = require('../src/models/Review');
const { carregarAvaliacoesDemo, CONTAS_DEMO } = require('../src/seed/avaliacoes');

test('Avaliações de demonstração: associações válidas, repetição segura e catálogo novo', async t => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  try {
    await mongoose.connect(mongo.getUri());
    const [produtor, segundo] = await User.create([
      { nome: 'Horta', email: 'horta@seed.pt', papel: 'produtor', passwordHash: 'hash' },
      { nome: 'Quinta', email: 'quinta@seed.pt', papel: 'produtor', passwordHash: 'hash' }
    ]);
    const produtos = await Product.create(Array.from({ length: 6 }, (_, i) => ({
      nome: `Produto ${i}`, produtor: i < 3 ? produtor.id : segundo.id, categoria: 'Fruta', preco: i + 1, stock: 10
    })));
    const antes = await Product.find().sort({ _id: 1 }).lean();

    await t.test('Uma conta incompatível cancela toda a transação', async () => {
      const conflito = await User.create({ nome: 'Conta reservada em conflito', email: CONTAS_DEMO[1].email, papel: 'admin', passwordHash: 'hash' });
      const total = await User.countDocuments();
      await assert.rejects(carregarAvaliacoesDemo, /conta reservada/);
      assert.equal(await User.countDocuments(), total);
      assert.equal(await User.countDocuments({ email: CONTAS_DEMO[0].email }), 0);
      assert.equal(await Order.countDocuments(), 0);
      assert.equal(await Review.countDocuments(), 0);
      await User.deleteOne({ _id: conflito.id });
    });

    await t.test('Cria avaliações, denúncias e encomendas coerentes sem alterar produtos', async () => {
      const resultado = await carregarAvaliacoesDemo();
      assert.equal(resultado.avaliacoesCriadas, 12);
      assert.equal(resultado.encomendasCriadas, 4);
      assert.equal(resultado.utilizadoresCriados, 3);
      assert.equal(resultado.avaliacoesDenunciadasCriadas, 2);
      assert.equal(resultado.avaliacoesOcultasCriadas, 1);
      assert.deepEqual(await Product.find().sort({ _id: 1 }).lean(), antes);
      for (const produto of produtos) {
        assert.equal(await Review.countDocuments({ produto: produto.id }), 2);
        assert(await Review.exists({ produto: produto.id, visivel: true }));
      }
      for (const r of await Review.find().select('+denunciantes')) {
        const o = await Order.findById(r.encomenda);
        assert.equal(o.estado, 'entregue');
        assert.equal(String(o.comprador), String(r.autor));
        assert.equal(String(o.produtor), String(r.produtor));
        assert(o.linhas.some(l => String(l.produto) === String(r.produto)));
        for (const linha of o.linhas) {
          const p = produtos.find(p => String(p.id) === String(linha.produto));
          assert.equal(linha.nome, p.nome);
          assert(!linha.nome.includes('Demonstração'));
        }
        assert(r.comentario.length > 0);
        assert(!r.comentario.includes('Demonstração'));
        assert.equal(r.denuncias, r.denunciantes.length);
        assert.equal(new Set(r.denunciantes.map(String)).size, r.denuncias);
        assert(!r.denunciantes.some(id => String(id) === String(r.autor)));
      }
    });

    await t.test('Repetir preserva moderação, contas e avaliações que não pertencem ao seed', async () => {
      const r = await Review.findOne({ denuncias: { $gt: 0 } });
      await Review.updateOne({ _id: r.id }, { denuncias: 0, denunciantes: [], visivel: false });
      const existente = await Review.findOne({ denuncias: 0, visivel: true });
      const produto = await Product.findById(existente.produto);
      const compra = await Order.create({ comprador: existente.autor, produtor: existente.produtor, estado: 'entregue',
        linhas: [{ produto: produto.id, nome: produto.nome, precoUnit: produto.preco, unidade: produto.unidade, quantidade: 1 }] });
      const externa = await Review.create({ autor: existente.autor, produto: existente.produto, produtor: existente.produtor,
        encomenda: compra.id, classificacao: 3, comentario: 'Avaliação anterior ao seed complementar.' });
      const documentos = await Promise.all([User.find().sort({ _id: 1 }).lean(), Order.find().sort({ _id: 1 }).lean(), Review.find().select('+denunciantes').sort({ _id: 1 }).lean()]);
      const resultado = await carregarAvaliacoesDemo();
      assert.equal(resultado.avaliacoesCriadas, 0);
      assert.equal(resultado.encomendasCriadas, 0);
      assert.equal(resultado.encomendasAtualizadas, 0);
      assert.equal(resultado.utilizadoresCriados, 0);
      assert.deepEqual(await Promise.all([User.find().sort({ _id: 1 }).lean(), Order.find().sort({ _id: 1 }).lean(), Review.find().select('+denunciantes').sort({ _id: 1 }).lean()]), documentos);
      assert.equal((await Review.findById(externa.id)).comentario, externa.comentario);
    });

    await t.test('Um produto novo recebe avaliações sem duplicar as encomendas anteriores', async () => {
      const novo = await Product.create({ nome: 'Produto novo', produtor: produtor.id, categoria: 'Fruta', preco: 3, stock: 2 });
      const resultado = await carregarAvaliacoesDemo();
      assert.equal(resultado.avaliacoesCriadas, 2);
      assert.equal(resultado.encomendasCriadas, 0);
      assert.equal(resultado.encomendasAtualizadas, 2);
      assert.equal(await Review.countDocuments({ produto: novo.id }), 2);
      assert.equal((await Product.findById(novo.id)).stock, 2);
    });
  } finally { await mongoose.disconnect(); await mongo.stop(); }
});

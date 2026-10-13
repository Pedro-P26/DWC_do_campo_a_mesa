const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { existsSync, readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const { carregarTestes, PASSWORD_TESTE } = require('../src/seed/testes');

test('Dados de teste são repetíveis e preservam documentos existentes', { timeout: 60000 }, async () => {
  const mongo = await MongoMemoryServer.create();
  try {
    await mongoose.connect(mongo.getUri());
    const passwordHash = await bcrypt.hash('password-existente', 4);
    const existente = await User.create({ nome: 'Produtor existente', email: 'existente@exemplo.pt', papel: 'produtor', passwordHash });
    const produtoExistente = await Product.create({ nome: 'Produto existente', produtor: existente._id, categoria: 'Fruta', preco: 15, stock: 10 });

    const primeira = await carregarTestes();
    assert.equal(primeira.utilizadoresCriados, 12);
    assert.equal(primeira.produtosCriados, 24);
    assert.equal(await User.countDocuments({}), 13);
    assert.equal(await Product.countDocuments({}), 25);
    assert.equal(await User.countDocuments({ papel: 'produtor', 'produtor.validado': true }), 7);
    assert.equal(await User.countDocuments({ papel: 'comprador' }), 3);
    const ids = primeira.utilizadores.filter(u => u.papel === 'produtor').map(u => u._id);
    assert.equal(await Product.countDocuments({ produtor: { $in: ids } }), 24);
    for (const produto of await Product.find({ produtor: { $in: ids } })) {
      assert.ok(produto.imagemUrl);
      assert.ok(existsSync(path.resolve(__dirname, '../../web/public', produto.imagemUrl.slice(1))));
    }
    const ana = await User.findOne({ email: 'ana@teste.exemplo.pt' }).select('+passwordHash');
    assert.equal(await bcrypt.compare(PASSWORD_TESTE, ana.passwordHash), true);

    await Product.updateOne({ nome: 'Kiwi Hayward', produtor: { $in: ids } }, { $set: { preco: 4.2, stock: 7, imagemUrl: '/uploads/personalizada.jpg' } });
    await Product.updateOne({ nome: 'Mel de urze', produtor: { $in: ids } }, { $unset: { imagemUrl: 1 } });
    await Product.updateOne({ nome: 'Mel de castanheiro', produtor: { $in: ids } }, { $set: { imagemUrl: '/images/produtos/mel.jpg' } });
    await User.updateOne({ _id: ana._id }, { $set: { nome: 'Nome alterado', passwordHash } });
    const segunda = await carregarTestes();
    assert.equal(segunda.utilizadoresCriados, 0);
    assert.equal(segunda.produtosCriados, 0);
    assert.equal(segunda.imagensPreenchidas, 2);
    assert.equal(await User.countDocuments({}), 13);
    assert.equal(await Product.countDocuments({}), 25);
    const kiwi = await Product.findOne({ nome: 'Kiwi Hayward' });
    assert.equal(kiwi.preco, 4.2);
    assert.equal(kiwi.stock, 7);
    assert.equal(kiwi.imagemUrl, '/uploads/personalizada.jpg');
    assert.equal((await Product.findOne({ nome: 'Mel de urze' })).imagemUrl, '/images/produtos/mel.jpg');
    assert.equal((await User.findById(ana._id).select('+passwordHash')).passwordHash, passwordHash);
    assert.equal((await User.findById(ana._id)).nome, 'Nome alterado');
    assert.equal((await User.findById(existente._id)).nome, 'Produtor existente');
    assert.equal((await Product.findById(produtoExistente._id)).preco, 15);

    const hortaOriginal = await User.create({ nome: 'Horta original', email: 'horta@exemplo.pt', papel: 'produtor', passwordHash });
    const melOriginal = await User.create({ nome: 'Mel original', email: 'mel@exemplo.pt', papel: 'produtor', passwordHash });
    for (const [produtor, nome, categoria, imagemUrl] of [
      [hortaOriginal._id, 'Kiwi Hayward', 'Fruta', '/images/produtos/kiwi.jpg'],
      [hortaOriginal._id, 'Abóbora-menina', 'Hortícolas', '/images/produtos/abobora.jpg'],
      [hortaOriginal._id, 'Couve-galega', 'Hortícolas', '/images/produtos/couve.jpg'],
      [melOriginal._id, 'Mel de urze', 'Mel', '/images/produtos/mel.jpg'],
      [melOriginal._id, 'Mel de castanheiro', 'Mel', '/images/produtos/mel.jpg']
    ]) await Product.create({ produtor, nome, categoria, imagemUrl, preco: 1, stock: 2 });
    assert.equal((await carregarTestes()).imagensPreenchidas, 5);
    assert.equal((await carregarTestes()).imagensPreenchidas, 0);
    const demonstracao = await Product.find({ produtor: { $in: [...ids, hortaOriginal._id, melOriginal._id] } });
    assert.equal(demonstracao.length, 29);
    assert.equal(new Set(demonstracao.map(p => p.imagemUrl)).size, 29);
    const hashes = demonstracao.map(p => p.imagemUrl === '/uploads/personalizada.jpg' ? 'personalizada' :
      createHash('sha256').update(readFileSync(path.resolve(__dirname, '../../web/public', p.imagemUrl.slice(1)))).digest('hex'));
    assert.equal(new Set(hashes).size, 29, 'As fotografias não podem repetir o mesmo conteúdo');
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});

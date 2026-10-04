const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Review = require('../src/models/Review');
const router = require('../src/routes/producers');

test('Página pública do produtor', async (t) => {
  const original = { findOne: User.findOne, find: Product.find, aggregate: Review.aggregate };
  const id = '507f1f77bcf86cd799439011';
  let encontrado = true;
  let comAvaliacoes = true;
  User.findOne = (filtro) => ({ select: async (campos) => {
    assert.equal(filtro.papel, 'produtor');
    assert.equal(filtro['produtor.validado'], true);
    assert.equal(campos, 'nome produtor');
    return encontrado ? { _id: id, nome: 'Produtor', produtor: { localidade: 'Ponte de Lima' } } : null;
  } });
  Product.find = async (filtro) => {
    assert.equal(filtro.produtor, id);
    return [{ _id: 'produto', nome: 'Kiwi' }];
  };
  Review.aggregate = async (pipeline) => {
    assert.equal(pipeline[0].$match.produtor.toString(), id);
    assert.equal(pipeline[0].$match.visivel, true);
    return comAvaliacoes ? [{ media: 4.5 }] : [];
  };
  const app = express();
  app.use('/api/producers', router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/producers`;
  try {
    await t.test('ID inválido ou produtor não público devolve 404', async () => {
      assert.equal((await fetch(`${base}/invalido`)).status, 404);
      encontrado = false;
      assert.equal((await fetch(`${base}/${id}`)).status, 404);
      encontrado = true;
    });
    await t.test('Devolve dados públicos, produtos e avaliação média', async () => {
      const resposta = await fetch(`${base}/${id}`);
      assert.equal(resposta.status, 200);
      const dados = await resposta.json();
      assert.equal(dados.produtor.nome, 'Produtor');
      assert.equal(dados.produtos[0].nome, 'Kiwi');
      assert.equal(dados.avaliacaoMedia, 4.5);
    });
    await t.test('Sem avaliações, a média é null', async () => {
      comAvaliacoes = false;
      assert.equal((await (await fetch(`${base}/${id}`)).json()).avaliacaoMedia, null);
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    User.findOne = original.findOne;
    Product.find = original.find;
    Review.aggregate = original.aggregate;
  }
});

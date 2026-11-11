const assert = require('node:assert/strict');
const path = require('node:path');
const { expect } = require('@playwright/test');
const User = require('../../src/models/User');
const Order = require('../../src/models/Order');
const Product = require('../../src/models/Product');
const Review = require('../../src/models/Review');
const Auction = require('../../src/models/Auction');

module.exports = async function ({ paginas, verificar, webUrl, pasta }) {
  const p = paginas.admin;
  const produtor = await User.findOne({ papel: 'produtor', 'produtor.validado': true });
  const comprador = await User.findOne({ papel: 'comprador' }).select('+passwordHash');
  const produto = await Product.findOne({ produtor: produtor._id });
  const produtores = [], pedidos = [], avaliacoes = [], leiloes = [];
  const secao = nome => p.getByRole('region', { name: nome, exact: true });
  const anterior = alvo => alvo.getByRole('button', { name: 'Página anterior', exact: true });
  const seguinte = alvo => alvo.getByRole('button', { name: 'Página seguinte', exact: true });
  const validarPagina = async (alvo, pagina, quantidade) => {
    await expect(alvo.locator('article')).toHaveCount(quantidade);
    await expect(alvo.getByText('Página ' + pagina + ' de 2', { exact: true })).toBeVisible();
  };
  try {
    for (let i = 0; i < 6; i++) {
      produtores.push(await User.create({ nome: 'Produtor da paginação ' + i, email: 'paginacao-' + i + '@exemplo.pt',
        papel: 'produtor', passwordHash: comprador.passwordHash,
        produtor: { validado: false, nomeExploracao: 'Quinta de agricultura biológica da comunidade ' + i, localidade: 'Ponte de Lima' } }));
      const pedido = await Order.create({ comprador: comprador._id, produtor: produtor._id, estado: 'entregue',
        linhas: [{ produto: produto._id, nome: produto.nome, quantidade: 1, precoUnit: produto.preco }] });
      pedidos.push(pedido);
      avaliacoes.push(await Review.create({ autor: comprador._id, produtor: produtor._id, produto: produto._id,
        encomenda: pedido._id, classificacao: 4, comentario: 'Comentário para validar a paginação e a moderação ' + i, denuncias: 1 }));
      leiloes.push(await Auction.create({ produtor: produtor._id, produto: produto._id, lote: 'Lote para paginação ' + i,
        precoBase: 15, incremento: 1, licitacaoAtual: { valor: 15 }, estado: 'ativo',
        iniciaEm: new Date(), terminaEm: new Date(Date.now() + 3600000) }));
    }
    await verificar('Administração: cinco registos por lista e paginação independente', async () => {
      await p.goto(webUrl + '/admin');
      const produtores = secao('Produtores por validar'), reviews = secao('Avaliações denunciadas'), leiloes = secao('Leilões ativos');
      for (const alvo of [produtores, reviews, leiloes]) {
        await validarPagina(alvo, 1, 5);
        await expect(anterior(alvo)).toBeDisabled();
      }
      const primeiroNome = await produtores.locator('article h3').first().textContent();
      await seguinte(produtores).click(); await validarPagina(produtores, 2, 1);
      assert.notEqual(await produtores.locator('article h3').first().textContent(), primeiroNome);
      await validarPagina(reviews, 1, 5); await validarPagina(leiloes, 1, 5);
      await seguinte(reviews).click(); await validarPagina(reviews, 2, 1);
      await seguinte(leiloes).click(); await validarPagina(leiloes, 2, 2);
      await expect(seguinte(produtores)).toBeDisabled();
      await anterior(produtores).click(); await validarPagina(produtores, 1, 5);
      await seguinte(produtores).click(); await validarPagina(produtores, 2, 1);
    });
    await verificar('Administração: moderar a última linha corrige a página sem alterar as outras listas', async () => {
      const produtores = secao('Produtores por validar'), reviews = secao('Avaliações denunciadas'), leiloes = secao('Leilões ativos');
      const artigo = leiloes.locator('article').first();
      const titulo = await artigo.locator('h3').textContent();
      const leilao = await Auction.findOne({ lote: titulo });
      await Auction.updateOne({ _id: leilao._id }, { $set: { 'licitacaoAtual.valor': 321, numLicitacoes: 4 } });
      await expect(artigo).toContainText('321,00', { timeout: 15000 });
      await expect(artigo).toContainText('4 licitações');
      await validarPagina(leiloes, 2, 2);
      await validarPagina(produtores, 2, 1);
      await validarPagina(reviews, 2, 1);
      await produtores.getByRole('button', { name: /Aprovar produtor/ }).click();
      await expect(produtores.locator('article')).toHaveCount(5);
      await expect(produtores.getByRole('navigation')).toHaveCount(0);
      await expect(produtores.getByText('A mostrar 1–5 de 5', { exact: true })).toBeVisible();
      await validarPagina(reviews, 2, 1); await validarPagina(leiloes, 2, 2);
      await reviews.getByRole('button', { name: 'Manter avaliação', exact: true }).click();
      await expect(reviews.locator('article')).toHaveCount(5);
      await expect(reviews.getByRole('navigation')).toHaveCount(0);
      await validarPagina(leiloes, 2, 2);
    });
    await verificar('Administração: listas e paginação sem sobreposições em mobile e desktop', async () => {
      for (const width of [320, 375, 768, 1024, 1440]) {
        await p.setViewportSize({ width, height: 900 });
        assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await expect(seguinte(secao('Leilões ativos'))).toBeVisible();
        await p.screenshot({ path: path.join(pasta, 'admin-paginacao-' + width + '.png'), fullPage: true });
      }
    });
  } finally {
    await Promise.all([
      User.deleteMany({ _id: { $in: produtores.map(d => d._id) } }),
      Review.deleteMany({ _id: { $in: avaliacoes.map(d => d._id) } }),
      Auction.deleteMany({ _id: { $in: leiloes.map(d => d._id) } }),
      Order.deleteMany({ _id: { $in: pedidos.map(d => d._id) } })
    ]);
    await p.setViewportSize({ width: 1280, height: 900 });
  }
};

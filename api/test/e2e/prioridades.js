const { expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');
const User = require('../../src/models/User');
const Product = require('../../src/models/Product');
const Order = require('../../src/models/Order');
const Review = require('../../src/models/Review');
const Auction = require('../../src/models/Auction');

module.exports = async ({ browser, paginas, verificar, apiUrl, webUrl, erros, pasta }) => {
  const comprador = paginas.comprador, produtor = paginas.produtor;
  const horta = await User.findOne({ email: 'horta@exemplo.pt' });
  const kiwi = await Product.findOne({ nome: 'Kiwi Hayward' });
  await verificar('Catálogo: produtor, localidade e destaque de leilão real', async () => {
    await comprador.goto(webUrl);
    await expect(comprador.getByRole('region', { name: 'Leilão em direto', exact: true })).toContainText('200 kg de kiwi Hayward');
    await comprador.getByLabel('Pesquisar produtos', { exact: true }).fill('Horta da Ribeira');
    await expect(comprador.locator('.cartao-produto')).toHaveCount(3);
    await comprador.getByRole('button', { name: /Mais filtros/ }).click();
    await comprador.getByLabel('Localidade', { exact: true }).fill('Arcos');
    await expect(comprador.locator('.cartao-produto')).toHaveCount(0);
    await comprador.getByRole('button', { name: 'Limpar filtros' }).click();
    await comprador.getByLabel('Produtor', { exact: true }).selectOption(horta.id);
    await comprador.getByLabel('Localidade', { exact: true }).fill('Lima');
    await expect(comprador.locator('.cartao-produto')).toHaveCount(3);
    await comprador.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(comprador.locator('.cartao-produto')).toHaveCount(5);
  });
  await verificar('Página pública: guardar, recarregar, localidade e avaliações visíveis', async () => {
    await produtor.goto(`${webUrl}/produtor/perfil`);
    await produtor.getByLabel('Descrição da exploração').fill('Da nossa horta para a sua mesa.');
    await produtor.getByLabel('Localidade', { exact: true }).fill('Ponte de Lima');
    await produtor.getByRole('button', { name: 'Guardar página pública' }).click();
    await expect(produtor.getByRole('status')).toHaveText('Página pública guardada.');
    await produtor.reload();
    await expect(produtor.getByLabel('Localidade', { exact: true })).toHaveValue('Ponte de Lima');
    await produtor.getByRole('link', { name: 'Ver página pública', exact: true }).click();
    await expect(produtor.getByText('Da nossa horta para a sua mesa.', { exact: true })).toBeVisible();
    await expect(produtor.getByText('Ponte de Lima', { exact: true }).first()).toBeVisible();
    await expect(produtor.getByTitle('Mapa de ' + horta.produtor.nomeExploracao)).toHaveAttribute('src', /q=Ponte%20de%20Lima%2C%20Portugal/);
    await expect(produtor.getByText('Kiwi fresco e entrega pontual.', { exact: true })).toBeVisible();
    await produtor.screenshot({ path: path.join(pasta, 'pagina-publica.png'), fullPage: true });
  });
  await verificar('Comprador avalia separadamente o produtor e um produto entregue', async () => {
    const conta = await User.findOne({ email: 'tasca@exemplo.pt' });
    const o = await Order.create({ comprador: conta.id, produtor: horta.id, estado: 'entregue',
      linhas: [{ produto: kiwi.id, nome: kiwi.nome, precoUnit: kiwi.preco, unidade: kiwi.unidade, quantidade: 1 }] });
    await comprador.goto(`${webUrl}/encomendas`);
    const card = comprador.getByTestId(`encomenda-${o.id}`);
    await card.getByLabel('O que pretende avaliar?', { exact: true }).selectOption(kiwi.id);
    await card.getByLabel('Comentário', { exact: true }).fill('Avaliação do produto pela interface.');
    await card.getByRole('button', { name: 'Enviar avaliação', exact: true }).click();
    await expect(comprador.getByRole('alert')).toHaveText('Avaliação enviada.');
    assert(await Review.exists({ encomenda: o.id, produto: kiwi.id }));
    await card.getByLabel('O que pretende avaliar?', { exact: true }).selectOption('');
    await card.getByLabel('Comentário', { exact: true }).fill('Avaliação do produtor pela interface.');
    const resposta = comprador.waitForResponse(r => r.url() === `${apiUrl}/api/reviews` && r.request().method() === 'POST');
    await card.getByRole('button', { name: 'Enviar avaliação', exact: true }).click();
    assert.equal((await resposta).status(), 201);
    assert.equal(await Review.countDocuments({ encomenda: o.id }), 2);
    await comprador.goto(`${webUrl}/produtos/${kiwi.id}`);
    await expect(comprador.getByText('Avaliação do produto pela interface.', { exact: true })).toBeVisible();
  });
  await verificar('Leilão em duas janelas: histórico, presença, saída, vencedor e encomenda', async () => {
    const leilao = await Auction.create({ produtor: horta.id, produto: kiwi.id, lote: 'Leilão de duas janelas', precoBase: 10, incremento: 1,
      licitacaoAtual: { valor: 10 }, iniciaEm: new Date(Date.now() - 1000), terminaEm: new Date(Date.now() + 600000), estado: 'ativo' });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    try {
      const outro = await context.newPage(); outro.on('pageerror', e => erros.push(e.message));
      const resposta = await context.request.post(`${apiUrl}/api/auth/registo`, { data: { nome: 'Segundo comprador', email: 'segundo@browser.pt', password: 'password123', papel: 'comprador' } });
      const sessao = await resposta.json(); assert.equal(resposta.status(), 201);
      await outro.goto(webUrl); await outro.evaluate(s => localStorage.setItem('sessao', JSON.stringify(s)), sessao);
      await Promise.all([comprador.goto(`${webUrl}/leiloes/${leilao.id}`), outro.goto(`${webUrl}/leiloes/${leilao.id}`)]);
      await expect(comprador.getByText('2 a assistir', { exact: true })).toBeVisible();
      await expect(outro.getByText('2 a assistir', { exact: true })).toBeVisible();
      await comprador.getByRole('button', { name: 'Licitar', exact: true }).click();
      await expect(outro.getByTestId('valor-atual')).toContainText('11,00');
      await outro.getByRole('button', { name: 'Licitar', exact: true }).click();
      await expect(comprador.getByTestId('valor-atual')).toContainText('12,00');
      await expect(comprador.locator('ol li')).toHaveCount(2);
      await outro.goto(`${webUrl}/perfil`);
      await expect(comprador.getByText('1 a assistir', { exact: true })).toBeVisible();
      await outro.goto(`${webUrl}/leiloes/${leilao.id}`);
      await expect(outro.getByText('2 a assistir', { exact: true })).toBeVisible();
      await Auction.updateOne({ _id: leilao.id }, { terminaEm: new Date(Date.now() - 1000) });
      await expect(comprador.getByText(/Leilão terminado\. Vencedor: Segundo comprador/)).toBeVisible({ timeout: 10000 });
      await expect(outro.getByRole('link', { name: 'Ver encomenda do leilão' })).toBeVisible();
      assert.equal(await Order.countDocuments({ leilao: leilao.id }), 1);
      await outro.screenshot({ path: path.join(pasta, 'leilao-vencedor.png'), fullPage: true });
    } finally { await context.close(); }
  });
};

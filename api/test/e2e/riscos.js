// Cenários adicionais: fronteiras entre contas, falhas e concorrência pela interface.
const assert = require('node:assert/strict');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { expect } = require('@playwright/test');
const User = require('../../src/models/User');
const Product = require('../../src/models/Product');
const Order = require('../../src/models/Order');
const Auction = require('../../src/models/Auction');
const Review = require('../../src/models/Review');

module.exports = async ({ browser, verificar, apiUrl, webUrl, erros, pasta }) => {
  const contextos = [];
  async function pagina(email) {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    contextos.push(c);
    await c.route('https://www.openstreetmap.org/**', r => r.fulfill({ contentType: 'text/html', body: '<p>Mapa externo</p>' }));
    await c.tracing.start({ screenshots: true, snapshots: true });
    const p = await c.newPage(); p.on('pageerror', e => erros.push(e.message));
    await p.goto(`${webUrl}/login`);
    await p.getByLabel('Email', { exact: true }).fill(email);
    await p.getByLabel('Password', { exact: true }).fill('password123');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(p).not.toHaveURL(`${webUrl}/login`);
    await expect(p.locator('header').getByRole('link', { name: 'Perfil', exact: true })).toBeVisible();
    return p;
  }
  async function pedir(p, rota, metodo = 'GET', corpo) {
    return p.evaluate(async ({ url, metodo, corpo }) => {
      const s = JSON.parse(localStorage.getItem('sessao'));
      const r = await fetch(url, { method: metodo, headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json' },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }) });
      return { status: r.status, dados: await r.json().catch(() => null) };
    }, { url: `${apiUrl}/api${rota}`, metodo, corpo });
  }
  async function adicionar(p, produto) {
    await p.goto(`${webUrl}/produtos/${produto.id}`);
    await p.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }).click();
    await p.getByRole('link', { name: 'Ver carrinho', exact: true }).click();
    await expect(p.getByText(produto.nome, { exact: true })).toBeVisible();
  }
  try {
    const horta = await User.findOne({ email: 'horta@exemplo.pt' });
    const conta = await User.findOne({ email: 'tasca@exemplo.pt' }).select('+passwordHash');
    const outro = await User.create({ nome: 'Outro comprador E2E', email: 'outro.riscos@e2e.pt', papel: 'comprador', passwordHash: conta.passwordHash });
    const produto = await Product.create({ produtor: horta.id, nome: 'Produto reservado E2E', categoria: 'Fruta', preco: 3, stock: 5 });
    const pedido = await Order.create({ comprador: conta.id, produtor: horta.id, estado: 'entregue',
      linhas: [{ produto: produto.id, nome: produto.nome, precoUnit: produto.preco, quantidade: 1, unidade: 'kg' }] });
    const comprador = await pagina(conta.email), segundo = await pagina(outro.email), produtorAlheio = await pagina('mel@exemplo.pt');

    await verificar('Autorização: outro produtor não vê ações nem altera ou elimina produto alheio', async () => {
      await produtorAlheio.goto(`${webUrl}/produtor`);
      await expect(produtorAlheio.getByTestId(`produto-${produto.id}`)).toHaveCount(0);
      assert.equal((await pedir(produtorAlheio, `/products/${produto.id}`, 'PUT', { nome: 'Alteração proibida', stock: 0 })).status, 404);
      assert.equal((await pedir(produtorAlheio, `/products/${produto.id}`, 'DELETE')).status, 404);
      const guardado = await Product.findById(produto.id);
      assert.equal(guardado.nome, produto.nome); assert.equal(guardado.stock, 5);
      assert.equal((await pedir(produtorAlheio, `/orders/${pedido.id}/estado`, 'PATCH', { estado: 'confirmada' })).status, 404);
      assert.equal((await Order.findById(pedido.id)).estado, 'entregue');
    });
    await verificar('Autorização: outro comprador não consulta nem avalia encomenda alheia', async () => {
      await segundo.goto(`${webUrl}/encomendas`);
      await expect(segundo.getByTestId(`encomenda-${pedido.id}`)).toHaveCount(0);
      assert.equal((await pedir(segundo, `/orders/${pedido.id}`)).status, 404);
      assert.equal((await pedir(segundo, '/reviews', 'POST', { encomenda: pedido.id, produto: produto.id, classificacao: 5 })).status, 404);
      assert.equal(await Review.countDocuments({ encomenda: pedido.id }), 0);
    });
    const agendado = await Auction.create({ produtor: horta.id, lote: 'Leilão agendado E2E', estado: 'agendado', precoBase: 20, incremento: 1,
      licitacaoAtual: { valor: 20 }, iniciaEm: new Date(Date.now() + 600000), terminaEm: new Date(Date.now() + 1200000) });
    await verificar('Leilão agendado abre pelo ciclo do servidor e ativa o formulário sem F5', async () => {
      await comprador.goto(`${webUrl}/leiloes/${agendado.id}`);
      await expect(comprador.getByText('Estado: agendado', { exact: true })).toBeVisible();
      await expect(comprador.getByRole('button', { name: 'Licitar', exact: true })).toHaveCount(0);
      await Auction.updateOne({ _id: agendado.id }, { iniciaEm: new Date(Date.now() - 1000) });
      await expect(comprador.getByText('Estado: ativo', { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(comprador.getByRole('button', { name: 'Licitar', exact: true })).toBeEnabled();
    });
    await verificar('Leilão sem propostas termina sem vencedor e sem encomenda', async () => {
      await Auction.updateOne({ _id: agendado.id }, { terminaEm: new Date(Date.now() - 1000) });
      await expect(comprador.getByRole('status').filter({ hasText: 'Leilão terminado. Sem licitações.' })).toBeVisible({ timeout: 10000 });
      assert.equal(await Order.countDocuments({ leilao: agendado.id }), 0);
      await expect(comprador.getByRole('button', { name: 'Licitar', exact: true })).toHaveCount(0);
    });
    await verificar('Token expira com sala aberta: sessão termina e formulário fica inacessível', async () => {
      const p = await pagina(conta.email);
      const ativo = await Auction.create({ produtor: horta.id, lote: 'Sala com sessão curta E2E', estado: 'ativo', precoBase: 10, incremento: 1,
        licitacaoAtual: { valor: 10 }, iniciaEm: new Date(Date.now() - 1000), terminaEm: new Date(Date.now() + 600000) });
      const token = jwt.sign({ id: conta.id, nome: conta.nome, papel: 'comprador' }, process.env.JWT_SECRET, { expiresIn: 8 });
      // Instala a sessão antes do arranque do React, sem disputar escritas com o perfil anterior.
      await p.context().addInitScript(s => localStorage.setItem('sessao', JSON.stringify(s)), { token, utilizador: conta.publico() });
      await p.goto(`${webUrl}/leiloes/${ativo.id}`);
      await expect(p.getByRole('heading', { name: ativo.lote, exact: true })).toBeVisible();
      await expect(p.getByRole('button', { name: 'Licitar', exact: true })).toBeEnabled();
      await expect(p).toHaveURL(`${webUrl}/login`, { timeout: 12000 });
      assert.equal(await p.evaluate(() => localStorage.getItem('sessao')), null);
    });
    await verificar('API inacessível no detalhe: erro visível e recuperação ao tentar novamente', async () => {
      const url = `${apiUrl}/api/products/${produto.id}`;
      await comprador.route(url, r => r.abort('connectionrefused'));
      await comprador.goto(`${webUrl}/produtos/${produto.id}`);
      await expect(comprador.getByRole('alert')).toBeVisible();
      await expect(comprador.getByRole('heading', { name: 'Não foi possível carregar o produto' })).toBeVisible();
      await comprador.unroute(url);
      await comprador.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
      await expect(comprador.getByRole('heading', { name: produto.nome, exact: true })).toBeVisible();
      await expect(comprador.getByRole('alert')).toHaveCount(0);
    });
    await verificar('Checkout interrompido antes de chegar à API mantém carrinho e permite nova tentativa', async () => {
      await adicionar(comprador, produto);
      const antes = await Order.countDocuments({ comprador: conta.id });
      const url = `${apiUrl}/api/orders`;
      const bloquear = r => r.request().method() === 'POST' ? r.abort('connectionreset') : r.continue();
      await comprador.route(url, bloquear);
      await comprador.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
      await expect(comprador.getByRole('alert')).toBeVisible();
      await expect(comprador.getByRole('button', { name: 'Finalizar compra', exact: true })).toBeEnabled();
      assert.equal(await Order.countDocuments({ comprador: conta.id }), antes);
      await expect(comprador.getByText(produto.nome, { exact: true })).toBeVisible();
      await comprador.unroute(url, bloquear);
      await comprador.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
      await expect(comprador.getByText('Compra concluída:', { exact: false })).toBeVisible();
      assert.equal(await Order.countDocuments({ comprador: conta.id }), antes + 1);
      assert.equal((await Product.findById(produto.id)).stock, 4);
    });
    await verificar('Dois compradores disputam o último artigo pela UI: uma compra e um conflito', async () => {
      const ultimo = await Product.create({ produtor: horta.id, nome: 'Última unidade E2E', categoria: 'Fruta', preco: 2, stock: 1 });
      await Promise.all([adicionar(comprador, ultimo), adicionar(segundo, ultimo)]);
      const url = `${apiUrl}/api/orders`, retidas = [];
      const bloquear = r => r.request().method() === 'POST' ? retidas.push(r) : r.continue();
      await comprador.route(url, bloquear); await segundo.route(url, bloquear);
      try {
        const respostas = [comprador, segundo].map(p => p.waitForResponse(r => r.url() === url && r.request().method() === 'POST'));
        await Promise.all([comprador, segundo].map(p => p.getByRole('button', { name: 'Finalizar compra', exact: true }).click()));
        await expect.poll(() => retidas.length).toBe(2);
        await Promise.all(retidas.map(r => r.continue()));
        const rs = await Promise.all(respostas);
        assert.deepEqual(rs.map(r => r.status()).sort(), [201, 409]);
        assert.equal((await Product.findById(ultimo.id)).stock, 0);
        assert.equal(await Order.countDocuments({ 'linhas.produto': ultimo.id }), 1);
        for (let i = 0; i < 2; i++) {
          const p = [comprador, segundo][i];
          if (rs[i].status() === 201) await expect(p.getByText('O carrinho está vazio.', { exact: true })).toBeVisible();
          else { await expect(p.getByRole('alert')).toContainText('stock insuficiente'); await expect(p.getByText(ultimo.nome, { exact: true })).toBeVisible(); }
        }
      } finally {
        await Promise.all(retidas.map(r => r.abort().catch(() => {})));
        await comprador.unroute(url, bloquear); await segundo.unroute(url, bloquear);
      }
    });
    await verificar('Avaliações: denunciar nas duas páginas e moderar a visibilidade pública', async () => {
      const texto = 'Comentário público para moderação E2E';
      const review = await Review.create({ autor: conta.id, produtor: horta.id, produto: produto.id, encomenda: pedido.id, classificacao: 4, comentario: texto });
      const admin = await pagina('admin@exemplo.pt');
      const publicoContexto = await browser.newContext(); contextos.push(publicoContexto);
      const publico = await publicoContexto.newPage(); publico.on('pageerror', e => erros.push(e.message));
      await publico.goto(`${webUrl}/produtos/${produto.id}`);
      const avaliacaoPublica = publico.getByTestId(`avaliacao-${review.id}`);
      await expect(avaliacaoPublica.getByRole('button', { name: 'Denunciar avaliação', exact: true })).toHaveCount(0);
      await avaliacaoPublica.getByRole('link', { name: 'Entrar para denunciar', exact: true }).click();
      await expect(publico).toHaveURL(`${webUrl}/login`);
      await publico.getByLabel('Email', { exact: true }).fill(outro.email);
      await publico.getByLabel('Password', { exact: true }).fill('password123');
      await publico.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(publico).toHaveURL(`${webUrl}/produtos/${produto.id}`);
      await publicoContexto.close();
      await comprador.goto(`${webUrl}/produtos/${produto.id}`);
      await expect(comprador.getByText(texto, { exact: true })).toBeVisible();
      const avaliacaoProduto = comprador.getByTestId(`avaliacao-${review.id}`);
      await avaliacaoProduto.getByRole('button', { name: 'Denunciar avaliação', exact: true }).click();
      await expect(avaliacaoProduto.getByRole('status')).toContainText('Denúncia enviada');
      await expect(avaliacaoProduto.getByRole('button', { name: 'Denúncia enviada', exact: true })).toBeDisabled();
      assert.equal((await Review.findById(review.id)).denuncias, 1);
      assert.equal((await pedir(comprador, `/reviews/${review.id}/denuncia`, 'POST')).status, 409);
      await comprador.reload();
      await avaliacaoProduto.getByRole('button', { name: 'Denunciar avaliação', exact: true }).click();
      await expect(avaliacaoProduto.getByRole('status')).toHaveText('Já denunciou esta avaliação.');
      assert.equal((await Review.findById(review.id)).denuncias, 1);
      await segundo.goto(`${webUrl}/produtores/${horta.id}`);
      await expect(segundo.getByText(texto, { exact: true })).toBeVisible();
      await segundo.getByTestId(`avaliacao-${review.id}`).getByRole('button', { name: 'Denunciar avaliação', exact: true }).click();
      await expect(segundo.getByTestId(`avaliacao-${review.id}`).getByRole('status')).toContainText('Denúncia enviada');
      assert.equal((await Review.findById(review.id)).denuncias, 2);
      await admin.goto(`${webUrl}/admin`);
      const card = admin.locator('article').filter({ hasText: texto });
      await card.getByRole('button', { name: 'Ocultar avaliação', exact: true }).click();
      await expect(card.getByRole('button', { name: 'Repor avaliação', exact: true })).toBeEnabled();
      await Promise.all([comprador.reload(), segundo.reload()]);
      await expect(comprador.getByRole('heading', { name: produto.nome, exact: true })).toBeVisible();
      await expect(segundo.getByRole('heading', { name: 'Horta da Ribeira', exact: true })).toBeVisible();
      await expect(comprador.getByText('A carregar avaliações…', { exact: true })).toHaveCount(0);
      await expect(segundo.getByText('A carregar avaliações…', { exact: true })).toHaveCount(0);
      await expect(comprador.getByText(texto, { exact: true })).toHaveCount(0);
      await expect(segundo.getByText(texto, { exact: true })).toHaveCount(0);
      assert.equal((await Review.findById(review.id)).visivel, false);
      await card.getByRole('button', { name: 'Repor avaliação', exact: true }).click();
      await expect(card.getByRole('button', { name: 'Ocultar avaliação', exact: true })).toBeEnabled();
      await Promise.all([comprador.reload(), segundo.reload()]);
      await expect(comprador.getByText(texto, { exact: true })).toBeVisible();
      await expect(segundo.getByText(texto, { exact: true })).toBeVisible();
      await card.getByRole('button', { name: 'Manter avaliação', exact: true }).click();
      await expect(card).toHaveCount(0);
      assert.equal((await Review.findById(review.id)).denuncias, 0);
    });
    await verificar('Imagem indisponível apresenta alternativa sem impedir a consulta do produto', async () => {
      await Product.updateOne({ _id: produto.id }, { imagemUrl: `${apiUrl}/uploads/imagem-e2e-inexistente.png` });
      await comprador.goto(`${webUrl}/produtos/${produto.id}`);
      await expect(comprador.getByText('Sem fotografia disponível', { exact: true })).toBeVisible();
      await expect(comprador.getByRole('heading', { name: produto.nome, exact: true })).toBeVisible();
      await comprador.screenshot({ path: path.join(pasta, 'riscos-produto-sem-imagem.png'), fullPage: true });
    });
  } finally {
    await Promise.all(contextos.map(async (c, i) => {
      await c.tracing.stop({ path: path.join(pasta, `riscos-trace-${i}.zip`) }).catch(() => {});
      await c.close();
    }));
  }
};

// Executa apenas numa base temporária; não lê a configuração .env.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { once } = require('node:events');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { chromium, expect } = require('@playwright/test');
const { Server } = require('socket.io');
const User = require('../../src/models/User');
const Product = require('../../src/models/Product');
const Order = require('../../src/models/Order');
const Review = require('../../src/models/Review');
const Auction = require('../../src/models/Auction');

async function main() {
  process.env.JWT_SECRET = 'teste-frontend-local-base-descartavel';
  process.env.JWT_EXPIRES_IN = '2h';
  const resultados = [];
  const erros = [];
  const pasta = path.resolve(__dirname, '../../test-results/frontend');
  await fs.mkdir(pasta, { recursive: true });
  let mongo, http, io, vite, browser, pararCiclo;
  async function verificar(nome, teste) {
    await teste();
    resultados.push(nome);
    console.log(`OK ${nome}`);
  }
  try {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await require('../../src/seed/seed').popularBD();
    const comprador = await User.findOne({ papel: 'comprador' }).select('+passwordHash');
    const pendente = await User.create({ nome: 'Quinta por validar', email: 'pendente@exemplo.pt', papel: 'produtor',
      passwordHash: comprador.passwordHash, produtor: { nomeExploracao: 'Quinta de teste', localidade: 'Ponte de Lima', validado: false } });
    const review = await Review.findOneAndUpdate({}, { $set: { denuncias: 1 } }, { new: true });
    const app = require('../../src/app');
    http = app.listen(0, '127.0.0.1');
    await once(http, 'listening');
    const apiUrl = `http://127.0.0.1:${http.address().port}`;
    io = new Server(http, { cors: { origin: (origin, cb) => cb(null, !origin || origin === process.env.CLIENT_URL) } });
    app.set('io', io);
    require('../../src/sockets')(io);
    pararCiclo = require('../../src/services/cicloLeiloes')(io);
    const raizWeb = path.resolve(__dirname, '../../../web');
    const { createServer } = await import(pathToFileURL(path.join(raizWeb, 'node_modules/vite/dist/node/index.js')).href);
    vite = await createServer({ root: raizWeb, server: { host: '127.0.0.1', port: 5180 },
      define: { 'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl), 'import.meta.env.VITE_USAR_DADOS_SIMULADOS': '"false"' } });
    await vite.listen();
    const webUrl = vite.resolvedUrls.local[0].replace(/\/$/, '');
    process.env.CLIENT_URL = webUrl;
    console.log(`Browser: ${webUrl}; API temporária: ${apiUrl}`);
    browser = await chromium.launch({ headless: process.argv.includes('--headless'), slowMo: 80 });
    const paginas = {};
    for (const [papel, email] of Object.entries({ comprador: 'tasca@exemplo.pt', admin: 'admin@exemplo.pt', produtor: 'horta@exemplo.pt' })) {
      const contexto = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const pagina = await contexto.newPage();
      pagina.on('pageerror', e => erros.push(e.message));
      await pagina.goto(`${webUrl}/login`);
      await pagina.getByLabel('Email', { exact: true }).fill(email);
      await pagina.getByLabel('Password', { exact: true }).fill('password123');
      await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(pagina.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
      paginas[papel] = pagina;
    }
    const pagina = paginas.comprador;
    await verificar('Detalhes do produto: acesso público, avaliações e adicionar ao carrinho', async () => {
      const contexto = await browser.newContext({ viewport: { width: 375, height: 900 } });
      const publico = await contexto.newPage();
      publico.on('pageerror', e => erros.push(e.message));
      await publico.bringToFront();
      await publico.goto(webUrl);
      await publico.getByRole('link', { name: 'Ver detalhes de Kiwi Hayward', exact: true }).click();
      await expect(publico.getByRole('heading', { name: 'Kiwi Hayward', exact: true })).toBeVisible();
      await expect(publico.getByText('300 kg em stock', { exact: true })).toBeVisible();
      await expect(publico.getByText('Kiwi fresco e entrega pontual.', { exact: true })).toBeVisible();
      await expect(publico.getByRole('link', { name: 'Registar para encomendar' })).toBeVisible();
      await expect(publico.getByRole('button', { name: 'Adicionar ao carrinho' })).toHaveCount(0);
      assert(await publico.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await publico.reload();
      await expect(publico.getByRole('heading', { name: 'Kiwi Hayward', exact: true })).toBeVisible();
      await publico.getByRole('link', { name: 'Horta da Ribeira', exact: true }).click();
      await expect(publico.getByRole('heading', { name: 'Horta da Ribeira', exact: true })).toBeVisible();
      await publico.getByRole('heading', { name: 'Kiwi Hayward', exact: true }).getByRole('link').click();
      await expect(publico.getByRole('heading', { name: 'Kiwi Hayward', exact: true })).toBeVisible();
      const produto = await Product.findOne({ nome: 'Kiwi Hayward' });
      await pagina.bringToFront();
      await pagina.goto(`${webUrl}/produtos/${produto._id}`);
      await pagina.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }).click();
      await expect(pagina.getByText('Produto adicionado ao carrinho.', { exact: false })).toBeVisible();
      await pagina.getByRole('link', { name: 'Ver carrinho', exact: true }).click();
      await expect(pagina.getByText('Kiwi Hayward', { exact: true })).toBeVisible();
      await pagina.getByRole('button', { name: 'Esvaziar carrinho', exact: true }).click();
      await publico.goto(`${webUrl}/produtos/000000000000000000000000`);
      await expect(publico.getByRole('alert')).toHaveText('Produto não encontrado');
      await contexto.close();
    });
    async function adicionar(nome) {
      await pagina.goto(webUrl);
      await pagina.locator('.cartao-produto').filter({ has: pagina.getByRole('heading', { name: nome, exact: true }) })
        .getByRole('button', { name: 'Adicionar', exact: true }).click();
    }
    await verificar('Preço máximo: decimal, zero, combinação e limpeza', async () => {
      await pagina.goto(webUrl);
      await expect(pagina.locator('.cartao-produto')).toHaveCount(5);
      await pagina.getByLabel('Preço máximo (€)').fill('1.5');
      await expect(pagina.locator('.cartao-produto')).toHaveCount(2);
      await pagina.getByLabel('Modo biológico').selectOption('Biologico');
      await expect(pagina.locator('.cartao-produto')).toHaveCount(1);
      await pagina.getByLabel('Preço máximo (€)').fill('0');
      await expect(pagina.locator('.cartao-produto')).toHaveCount(0);
      await pagina.getByRole('button', { name: 'Limpar filtros' }).click();
      await expect(pagina.locator('.cartao-produto')).toHaveCount(5);
    });
    await verificar('Levantamento: uma encomenda por produtor e proteção contra submissão duplicada', async () => {
      await adicionar('Kiwi Hayward');
      await adicionar('Mel de urze');
      await pagina.goto(`${webUrl}/carrinho`);
      const antes = await Order.countDocuments();
      const stock = (await Product.findOne({ nome: 'Kiwi Hayward' })).stock;
      await pagina.locator('form').evaluate(form => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      await expect(pagina.getByText('Compra concluída:', { exact: false })).toBeVisible();
      assert.equal(await Order.countDocuments(), antes + 2);
      assert.equal((await Product.findOne({ nome: 'Kiwi Hayward' })).stock, stock - 1);
      const novas = await Order.find().sort({ createdAt: -1 }).limit(2);
      assert.equal(new Set(novas.map(o => String(o.produtor))).size, 2);
      assert(novas.every(o => o.entrega.tipo === 'levantamento'));
      await expect(pagina.getByText('O carrinho está vazio.', { exact: true })).toBeVisible();
    });
    await verificar('Entrega: morada obrigatória e persistência da encomenda', async () => {
      await adicionar('Kiwi Hayward');
      await pagina.goto(`${webUrl}/carrinho`);
      await pagina.getByLabel('Receber os produtos').selectOption('entrega');
      const antes = await Order.countDocuments();
      await pagina.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
      assert.equal(await Order.countDocuments(), antes);
      await pagina.getByLabel('Morada de entrega').fill('Rua do teste, 10, Ponte de Lima');
      await pagina.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
      await expect(pagina.getByText('Compra concluída:', { exact: false })).toBeVisible();
      const nova = await Order.findOne().sort({ createdAt: -1 });
      assert.equal(nova.entrega.morada, 'Rua do teste, 10, Ponte de Lima');
    });
    await verificar('Stock alterado: erro mantém o carrinho e não cria encomendas', async () => {
      await adicionar('Kiwi Hayward');
      await pagina.goto(`${webUrl}/carrinho`);
      const produto = await Product.findOne({ nome: 'Kiwi Hayward' });
      const antes = await Order.countDocuments();
      await Product.updateOne({ _id: produto._id }, { stock: 0 });
      await pagina.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
      await expect(pagina.getByRole('alert')).toBeVisible();
      assert.equal(await Order.countDocuments(), antes);
      await expect(pagina.getByRole('button', { name: 'Remover', exact: true })).toBeVisible();
      await Product.updateOne({ _id: produto._id }, { stock: produto.stock });
    });
    const admin = paginas.admin;
    await verificar('Administração: indicadores reais e leilões ativos', async () => {
      await admin.goto(`${webUrl}/admin`);
      await expect(admin.locator('dl dd')).toHaveCount(4);
      const valores = await admin.locator('dl dd').allTextContents();
      assert.equal(Number(valores[0]), await User.countDocuments());
      assert.equal(Number(valores[2]), await Order.countDocuments());
      assert.equal(Number(valores[3]), await Auction.countDocuments({ estado: 'ativo' }));
      await expect(admin.getByRole('link', { name: 'Abrir sala do leilão' })).toBeVisible();
    });
    await verificar('Administração: aprovação de produtor', async () => {
      await admin.getByRole('button', { name: 'Aprovar produtor' }).click();
      await expect(admin.getByText('Não há produtores por validar.')).toBeVisible();
      assert.equal((await User.findById(pendente._id)).produtor.validado, true);
    });
    await verificar('Administração: ocultar e repor avaliação denunciada', async () => {
      await admin.getByRole('button', { name: 'Ocultar avaliação' }).click();
      await expect(admin.getByRole('button', { name: 'Repor avaliação' })).toBeEnabled();
      assert.equal((await Review.findById(review._id)).visivel, false);
      await admin.getByRole('button', { name: 'Repor avaliação' }).click();
      await expect(admin.getByRole('button', { name: 'Ocultar avaliação' })).toBeEnabled();
      assert.equal((await Review.findById(review._id)).visivel, true);
    });
    const leilao = await Auction.findOne({ estado: 'ativo' });
    const produtor = await User.findOne({ email: 'horta@exemplo.pt' });
    const kiwi = await Product.findOne({ nome: 'Kiwi Hayward' });
    const visitante = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    visitante.on('pageerror', e => erros.push(e.message));
    const rotas = [[visitante, '/'], [visitante, '/login'], [visitante, '/registo'], [visitante, '/leiloes'],
      [visitante, `/produtores/${produtor._id}`], [visitante, '/pagina-inexistente'],
      [pagina, '/carrinho'], [pagina, '/encomendas'], [pagina, `/leiloes/${leilao._id}`],
      [paginas.produtor, '/produtor'], [paginas.produtor, '/produtor/leiloes/novo'], [admin, '/admin'],
      [visitante, `/produtos/${kiwi._id}`]];
    async function semOverflow(p) {
      await expect.poll(() => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      assert.equal(await p.locator('.por-implementar').count(), 0);
    }
    for (const largura of [320, 375, 768, 1024, 1280]) {
      await verificar(`Responsividade: 13 páginas a ${largura}px, menu e checkout`, async () => {
        for (const [p, rota] of rotas) {
          await p.bringToFront();
          await p.setViewportSize({ width: largura, height: 900 });
          await p.goto(`${webUrl}${rota}`);
          await expect(p.locator('main h1')).toBeVisible();
          assert.equal(new URL(p.url()).pathname, rota);
          await expect.poll(() => p.locator('main').innerText()).not.toMatch(/A carregar|A validar/);
          await semOverflow(p);
          if (rota === '/') {
            await expect(p.locator('.cartao-produto')).toHaveCount(5);
            const colunas = await p.locator('.grelha-produtos').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
            assert.equal(colunas, largura < 768 ? 2 : largura < 1024 ? 3 : 4);
            if (largura < 1024) {
              await p.getByRole('button', { name: 'Abrir menu' }).click();
              await expect(p.locator('#menu')).toBeVisible();
              await semOverflow(p);
            } else await expect(p.getByRole('button', { name: 'Abrir menu' })).toBeHidden();
          }
          if (rota === '/carrinho') {
            await p.getByLabel('Receber os produtos').selectOption('entrega');
            await p.getByLabel('Morada de entrega').fill('Rua da responsividade, Ponte de Lima');
            await semOverflow(p);
          }
        }
      });
    }
    await verificar('Sem erros JavaScript no browser', async () => assert.deepEqual(erros, []));
    await admin.setViewportSize({ width: 1280, height: 900 });
    await admin.goto(`${webUrl}/admin`);
    await admin.screenshot({ path: path.join(pasta, 'administracao.png'), fullPage: true });
    await pagina.setViewportSize({ width: 375, height: 900 });
    await pagina.goto(`${webUrl}/carrinho`);
    await pagina.getByLabel('Receber os produtos').selectOption('entrega');
    await pagina.screenshot({ path: path.join(pasta, 'checkout-mobile.png'), fullPage: true });
    await fs.writeFile(path.join(pasta, 'resultado.json'), JSON.stringify({ sucesso: true, testes: resultados, paginas: 65, larguras: [320, 375, 768, 1024, 1280], erros }, null, 2));
    console.log(`${resultados.length} testes passaram. Evidências: ${pasta}`);
    if (process.argv.includes('--keep-open')) {
      console.log('Browser aberto para inspeção. Feche o browser para terminar os servidores temporários.');
      await once(browser, 'disconnected');
    }
  } catch (erro) {
    await fs.writeFile(path.join(pasta, 'resultado.json'), JSON.stringify({ sucesso: false, testes: resultados, erro: erro.stack }, null, 2));
    throw erro;
  } finally {
    pararCiclo?.();
    await browser?.close();
    await vite?.close();
    if (io) await new Promise(resolve => io.close(resolve));
    else if (http) await new Promise(resolve => http.close(resolve));
    await mongoose.disconnect();
    await mongo?.stop();
  }
}
async function testarSimulados() {
  const raizWeb = path.resolve(__dirname, '../../../web');
  const { createServer } = await import(pathToFileURL(path.join(raizWeb, 'node_modules/vite/dist/node/index.js')).href);
  const vite = await createServer({ root: raizWeb, server: { host: '127.0.0.1', port: 5181 },
    define: { 'import.meta.env.VITE_USAR_DADOS_SIMULADOS': '"true"' } });
  let browser;
  try {
    await vite.listen();
    browser = await chromium.launch({ headless: process.argv.includes('--headless'), slowMo: 150 });
    const pagina = await browser.newPage({ viewport: { width: 375, height: 900 } });
    const pedidos = [];
    pagina.on('request', pedido => { if (pedido.url().includes('/api/products')) pedidos.push(pedido.url()); });
    await pagina.goto(vite.resolvedUrls.local[0]);
    await expect(pagina.locator('.cartao-produto')).toHaveCount(8);
    await pagina.getByLabel('Preço máximo (€)').fill('1.5');
    await expect(pagina.locator('.cartao-produto')).toHaveCount(2);
    await pagina.getByLabel('Modo biológico').selectOption('Biologico');
    await expect(pagina.locator('.cartao-produto')).toHaveCount(1);
    await pagina.getByLabel('Preço máximo (€)').fill('0');
    await expect(pagina.locator('.cartao-produto')).toHaveCount(0);
    await pagina.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(pagina.locator('.cartao-produto')).toHaveCount(8);
    assert.deepEqual(pedidos, []);
    const pasta = path.resolve(__dirname, '../../test-results/frontend');
    await fs.mkdir(pasta, { recursive: true });
    await fs.writeFile(path.join(pasta, 'simulados.json'), JSON.stringify({ sucesso: true, teste: 'Preço decimal, zero, combinação e limpeza sem pedidos à API' }, null, 2));
    console.log('OK Filtro de preço com dados simulados, sem pedidos à API');
  } finally {
    await browser?.close();
    await vite.close();
  }
}
(process.argv.includes('--simulados') ? testarSimulados() : main()).catch(erro => { console.error(erro); process.exitCode = 1; });

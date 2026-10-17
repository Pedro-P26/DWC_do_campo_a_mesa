const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { once } = require('node:events');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { chromium, expect } = require('@playwright/test');
const { Server } = require('socket.io');
const Product = require('../../src/models/Product');
const Order = require('../../src/models/Order');

async function main() {
  process.env.JWT_SECRET = 'teste-carrinho-desktop-base-descartavel';
  process.env.JWT_EXPIRES_IN = '2h';
  const pasta = path.resolve(__dirname, '../../test-results/carrinho-desktop');
  await fs.mkdir(pasta, { recursive: true });
  const resultados = [], erros = [], capturas = [];
  let mongo, http, io, vite, browser, pagina;
  async function verificar(nome, teste) {
    await teste();
    resultados.push(nome);
    console.log(`OK ${nome}`);
  }
  async function captura(nome, alvo = pagina) {
    await alvo.screenshot({ path: path.join(pasta, nome), fullPage: true });
    capturas.push(nome);
  }
  try {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await require('../../src/seed/seed').popularBD();
    const app = require('../../src/app');
    http = app.listen(0, '127.0.0.1');
    await once(http, 'listening');
    const apiUrl = `http://127.0.0.1:${http.address().port}`;
    io = new Server(http, { cors: { origin: (origin, cb) => cb(null, !origin || origin === process.env.CLIENT_URL) } });
    app.set('io', io);
    require('../../src/sockets')(io);
    const raizWeb = path.resolve(__dirname, '../../../web');
    const { createServer } = await import(pathToFileURL(path.join(raizWeb, 'node_modules/vite/dist/node/index.js')).href);
    vite = await createServer({ root: raizWeb, server: { host: '127.0.0.1', port: 0 },
      define: { 'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl), 'import.meta.env.VITE_USAR_DADOS_SIMULADOS': '"false"' } });
    await vite.listen();
    const webUrl = vite.resolvedUrls.local[0].replace(/\/$/, '');
    process.env.CLIENT_URL = webUrl;
    console.log(`Browser: ${webUrl}; API e MongoDB temporários.`);
    browser = await chromium.launch({ headless: !process.argv.includes('--keep-open') });
    pagina = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    pagina.on('pageerror', e => erros.push(e.message));
    const header = pagina.locator('header');
    const contador = n => header.getByRole('link', { name: `Carrinho (${n})`, exact: true });
    const linha = nome => pagina.locator('main li.list-group-item').filter({ hasText: nome });
    const quantidade = nome => linha(nome).getByRole('spinbutton', { name: 'Quantidade', exact: true });
    const total = valor => pagina.getByText(`Total: ${valor.toFixed(2)} €`, { exact: true });
    async function adicionar(nome) {
      await pagina.goto(webUrl);
      await pagina.locator('.cartao-produto').filter({ has: pagina.getByRole('heading', { name: nome, exact: true }) })
        .getByRole('button', { name: 'Adicionar', exact: true }).click();
    }
    const kiwi = await Product.findOne({ nome: 'Kiwi Hayward' });
    const mel = await Product.findOne({ nome: 'Mel de urze' });

    await verificar('Login de comprador e carrinho vazio no computador', async () => {
      await pagina.goto(`${webUrl}/login`);
      await pagina.getByLabel('Email', { exact: true }).fill('tasca@exemplo.pt');
      await pagina.getByLabel('Password', { exact: true }).fill('password123');
      await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(contador(0)).toBeVisible();
      await expect(pagina.getByRole('navigation', { name: 'Navegação móvel' })).toBeHidden();
      await contador(0).click();
      await expect(pagina.getByText('O carrinho está vazio.', { exact: true })).toBeVisible();
      await expect(total(0)).toBeVisible();
      await expect(pagina.getByRole('button', { name: 'Finalizar compra', exact: true })).toHaveCount(0);
      await captura('01-carrinho-vazio.png');
    });
    await verificar('Adicionar pelo catálogo atualiza o contador para Carrinho (1)', async () => {
      await adicionar(kiwi.nome);
      await expect(contador(1)).toBeVisible();
      await captura('02-catalogo-produto-adicionado.png');
      await captura('03-contador-desktop.png', header);
    });
    await verificar('Repetir o mesmo produto aumenta a quantidade e mantém um produto no contador', async () => {
      await adicionar(kiwi.nome);
      await adicionar(kiwi.nome);
      await expect(contador(1)).toBeVisible();
      await contador(1).click();
      await expect(quantidade(kiwi.nome)).toHaveValue('3');
      await expect(total(kiwi.preco * 3)).toBeVisible();
      await expect(pagina.locator('main li.list-group-item')).toHaveCount(1);
    });
    await verificar('Dois produtos de produtores diferentes: contador, linhas e total corretos', async () => {
      await adicionar(mel.nome);
      await expect(contador(2)).toBeVisible();
      await contador(2).click();
      await expect(pagina.locator('main li.list-group-item')).toHaveCount(2);
      await expect(quantidade(kiwi.nome)).toHaveValue('3');
      await expect(quantidade(mel.nome)).toHaveValue('1');
      await expect(total(kiwi.preco * 3 + mel.preco)).toBeVisible();
      await captura('04-carrinho-com-produtos.png');
    });
    await verificar('Alterar quantidades recalcula o total e respeita o stock', async () => {
      await quantidade(kiwi.nome).fill('4');
      await expect(total(kiwi.preco * 4 + mel.preco)).toBeVisible();
      await quantidade(kiwi.nome).fill(String(kiwi.stock + 10));
      await expect(quantidade(kiwi.nome)).toHaveValue(String(kiwi.stock));
      await expect(total(kiwi.preco * kiwi.stock + mel.preco)).toBeVisible();
      await quantidade(kiwi.nome).fill('2');
      await expect(total(kiwi.preco * 2 + mel.preco)).toBeVisible();
      await expect(contador(2)).toBeVisible();
    });
    await verificar('Produtos e quantidades persistem ao navegar e recarregar a página', async () => {
      await header.getByRole('link', { name: 'Produtos', exact: true }).click();
      await expect(contador(2)).toBeVisible();
      await contador(2).click();
      await pagina.reload();
      await expect(quantidade(kiwi.nome)).toHaveValue('2');
      await expect(quantidade(mel.nome)).toHaveValue('1');
      await expect(contador(2)).toBeVisible();
      await expect(total(kiwi.preco * 2 + mel.preco)).toBeVisible();
    });
    await verificar('Carrinho sem deslocamento horizontal a 1024, 1280, 1440 e 1920 px', async () => {
      for (const largura of [1024, 1280, 1440, 1920]) {
        await pagina.setViewportSize({ width: largura, height: 1000 });
        await expect(contador(2)).toBeVisible();
        await expect(pagina.getByRole('button', { name: 'Finalizar compra', exact: true })).toBeVisible();
        await expect.poll(() => pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        for (const campo of await pagina.getByRole('spinbutton', { name: 'Quantidade', exact: true }).all()) {
          const rect = await campo.boundingBox();
          assert(rect && rect.x >= 0 && rect.x + rect.width <= largura);
        }
        await captura(`05-carrinho-${largura}px.png`);
      }
      await pagina.setViewportSize({ width: 1440, height: 1000 });
    });
    await verificar('Remover artigos atualiza contador e total até ao estado vazio', async () => {
      await linha(mel.nome).getByRole('button', { name: 'Remover', exact: true }).click();
      await expect(contador(1)).toBeVisible();
      await expect(total(kiwi.preco * 2)).toBeVisible();
      await linha(kiwi.nome).getByRole('button', { name: 'Remover', exact: true }).click();
      await expect(contador(0)).toBeVisible();
      await expect(pagina.getByText('O carrinho está vazio.', { exact: true })).toBeVisible();
      await expect(total(0)).toBeVisible();
    });
    await verificar('Esvaziar carrinho limpa também o armazenamento e mantém zero após recarregar', async () => {
      await adicionar(kiwi.nome);
      await adicionar(mel.nome);
      await contador(2).click();
      await pagina.getByRole('button', { name: 'Esvaziar carrinho', exact: true }).click();
      await expect(contador(0)).toBeVisible();
      await expect.poll(() => pagina.evaluate(() => JSON.parse(localStorage.getItem('carrinho')))).toEqual([]);
      await pagina.reload();
      await expect(pagina.getByText('O carrinho está vazio.', { exact: true })).toBeVisible();
    });
    await verificar('Entrega exige morada antes de criar qualquer encomenda', async () => {
      await adicionar(kiwi.nome);
      await adicionar(mel.nome);
      await contador(2).click();
      await pagina.getByLabel('Receber os produtos').selectOption('entrega');
      const antes = await Order.countDocuments();
      await pagina.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
      assert.equal(await Order.countDocuments(), antes);
      assert(await pagina.getByLabel('Morada de entrega').evaluate(e => e.validity.valueMissing));
      await pagina.getByLabel('Morada de entrega').fill('Rua de teste, 10, Ponte de Lima');
      await captura('06-carrinho-entrega.png');
    });
    await verificar('Finalizar compra cria uma encomenda por produtor, reduz stock e limpa o contador', async () => {
      const antes = await Order.countDocuments();
      await pagina.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
      await expect(pagina.getByText('Compra concluída: 2 encomendas criadas.', { exact: false })).toBeVisible();
      await expect(contador(0)).toBeVisible();
      await expect(pagina.getByText('O carrinho está vazio.', { exact: true })).toBeVisible();
      assert.equal(await Order.countDocuments(), antes + 2);
      const novas = await Order.find().sort({ createdAt: -1 }).limit(2);
      assert.equal(new Set(novas.map(o => String(o.produtor))).size, 2);
      assert(novas.every(o => o.entrega.tipo === 'entrega' && o.entrega.morada === 'Rua de teste, 10, Ponte de Lima'));
      assert.equal((await Product.findById(kiwi._id)).stock, kiwi.stock - 1);
      assert.equal((await Product.findById(mel._id)).stock, mel.stock - 1);
      await captura('07-compra-concluida.png');
    });
    await verificar('Stock insuficiente mostra erro e preserva o carrinho sem criar encomendas', async () => {
      await adicionar(kiwi.nome);
      await contador(1).click();
      await Product.updateOne({ _id: kiwi._id }, { stock: 0 });
      const antes = await Order.countDocuments();
      await pagina.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
      await expect(pagina.getByRole('alert')).toHaveText('Produto indisponível ou stock insuficiente');
      await expect(contador(1)).toBeVisible();
      await expect(quantidade(kiwi.nome)).toHaveValue('1');
      assert.equal(await Order.countDocuments(), antes);
      await captura('08-stock-insuficiente.png');
    });
    await verificar('Sem erros JavaScript no browser', async () => assert.deepEqual(erros, []));
    const observacoes = {
      contador: 'Conta produtos diferentes; repetir o mesmo produto aumenta apenas a quantidade.',
      desktop: 'O cabeçalho mostra Carrinho (N), sem ícone nem bolinha sobreposta.',
      catalogo: 'Adicionar no catálogo atualiza o contador; não apresenta uma mensagem de confirmação.'
    };
    await fs.writeFile(path.join(pasta, 'resultado.json'), JSON.stringify({ sucesso: true,
      testes: resultados, larguras: [1024, 1280, 1440, 1920], capturas, observacoes, erros }, null, 2));
    console.log(`${resultados.length} testes passaram. Capturas e relatório: ${pasta}`);
    if (process.argv.includes('--keep-open')) {
      console.log('Feche o browser para terminar os servidores temporários.');
      await once(browser, 'disconnected');
    }
  } catch (erro) {
    if (pagina && !pagina.isClosed()) await captura('falha.png').catch(() => {});
    await fs.writeFile(path.join(pasta, 'resultado.json'), JSON.stringify({ sucesso: false, testes: resultados,
      capturas, erros, erro: erro.stack }, null, 2));
    throw erro;
  } finally {
    await browser?.close();
    await vite?.close();
    if (io) await new Promise(resolve => io.close(resolve));
    else if (http) await new Promise(resolve => http.close(resolve));
    await mongoose.disconnect();
    await mongo?.stop();
  }
}

main().catch(erro => { console.error(erro); process.exitCode = 1; });

const { chromium, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const produtos = require('../../../web/src/data/produtos.json');
const base = process.env.APP_URL || 'http://localhost:5173';
const comprador = { id: 'comprador-teste', _id: 'comprador-teste', nome: 'Comprador de teste', email: 'comprador@teste.exemplo.pt', papel: 'comprador' };
const produtor = { id: 'horta-ribeira', _id: 'horta-ribeira', nome: 'Horta da Ribeira', email: 'horta@teste.exemplo.pt', papel: 'produtor',
  produtor: { nomeExploracao: 'Horta da Ribeira', localidade: 'Ponte de Lima', validado: true } };
const admin = { id: 'admin-teste', _id: 'admin-teste', nome: 'Administração de teste', email: 'admin@teste.exemplo.pt', papel: 'admin' };
const pendente = { ...produtor, produtor: { ...produtor.produtor, validado: false } };

async function contextoTeste(browser, utilizador, carrinho = []) {
  const contexto = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let atual = utilizador;
  await contexto.addInitScript(({ utilizador, carrinho }) => {
    if (utilizador) localStorage.setItem('sessao', JSON.stringify({ token: 'token-teste', utilizador }));
    localStorage.setItem('carrinho', JSON.stringify(carrinho));
  }, { utilizador, carrinho });
  await contexto.route('**/socket.io/**', route => route.abort());
  await contexto.route('**/api/**', async route => {
    const caminho = new URL(route.request().url()).pathname;
    if (!caminho.startsWith('/api/')) return route.continue();
    if (caminho.endsWith('/auth/login') || caminho.endsWith('/auth/registo')) {
      atual = caminho.endsWith('/auth/login') ? comprador : { ...comprador, nome: route.request().postDataJSON().nome };
      return route.fulfill({ json: { token: 'token-teste', utilizador: atual } });
    }
    if (caminho.endsWith('/auth/eu')) return route.fulfill(atual ? { json: atual } : { status: 401, json: { erro: 'Sem sessão' } });
    if (route.request().method() !== 'GET') throw new Error(`Pedido de escrita inesperado: ${caminho}`);
    if (caminho === '/api/products') return route.fulfill({ json: produtos });
    if (caminho.startsWith('/api/products/')) return route.fulfill({ json: produtos.find(p => caminho.endsWith(`/${p._id}`)) || produtos[0] });
    if (caminho.startsWith('/api/producers/')) return route.fulfill({ json: { produtor, produtos: produtos.slice(0, 2), avaliacaoMedia: null } });
    return route.fulfill({ json: [] });
  });
  return contexto;
}

(async () => {
  const destino = path.join(process.env.TEMP, 'navegacao-mobile-campo-mesa');
  fs.mkdirSync(destino, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true });
  try {
    for (const [nome, utilizador, rotulos] of [
      ['visitante', null, ['Leilões', 'Produtos', 'Perfil']],
      ['comprador', comprador, ['Leilões', 'Carrinho', 'Produtos', 'Encomendas', 'Perfil']],
      ['produtor', produtor, ['Painel', 'Produtos', 'Leilões', 'Perfil']],
      ['administrador', admin, ['Admin', 'Produtos', 'Leilões', 'Perfil']],
      ['produtor-pendente', pendente, ['Painel', 'Produtos', 'Leilões', 'Perfil']]
    ]) {
      const contexto = await contextoTeste(browser, utilizador, utilizador?.papel === 'comprador' ? [{ produto: produtos[0], quantidade: 2 }] : []);
      const p = await contexto.newPage();
      const erros = [];
      p.on('pageerror', e => erros.push(e.message));
      await p.goto(`${base}/perfil`);
      await expect(p.getByRole('heading', { name: 'Perfil', exact: true })).toBeVisible();
      const barra = p.getByRole('navigation', { name: 'Navegação móvel' });
      assert.deepEqual(await barra.locator('.barra-mobile__rotulo').allTextContents(), rotulos);
      await expect(barra.getByRole('link', { name: 'Perfil', exact: true })).toHaveAttribute('aria-current', 'page');
      if (nome === 'produtor') await expect(p.getByText('Aprovado', { exact: true })).toBeVisible();
      if (nome === 'produtor-pendente') {
        await expect(p.getByText('A aguardar aprovação', { exact: true })).toBeVisible();
        await expect(p.getByRole('link', { name: 'Página pública', exact: true })).toHaveCount(0);
      }
      if (nome === 'comprador') await expect(barra.getByRole('link', { name: 'Carrinho, 1 produto' })).toBeVisible();

      for (const width of [320, 390, 430, 768, 1023, 1024, 1440]) {
        await p.setViewportSize({ width, height: 844 });
        if (width < 1024) {
          await expect(barra).toBeVisible();
          if (['visitante', 'comprador'].includes(nome)) {
            const home = await barra.getByRole('link', { name: 'Produtos', exact: true }).boundingBox();
            const nav = await barra.boundingBox();
            assert.ok(Math.abs(home.x + home.width / 2 - (nav.x + nav.width / 2)) < 1, 'Produtos deve ficar ao centro');
          }
          assert.ok(await barra.locator('a').evaluateAll(links => links.every(e => e.getBoundingClientRect().height >= 44)));
          assert.ok(await barra.locator('.barra-mobile__rotulo').evaluateAll(rotulos => rotulos.every(e => {
            const r = document.createRange(); r.selectNodeContents(e);
            return r.getBoundingClientRect().width <= e.closest('a').getBoundingClientRect().width;
          })));
          assert.ok(await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('main')).paddingBottom) >= document.querySelector('.barra-mobile').getBoundingClientRect().height));
        } else {
          await expect(barra).toBeHidden();
          await expect(p.locator('header').getByRole('link', { name: 'Perfil', exact: true })).toBeVisible();
          assert.equal(await p.locator('main').evaluate(e => getComputedStyle(e).paddingBottom), '24px');
        }
        assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${nome}: overflow a ${width}px`);
        if ([390, 1440].includes(width)) await p.screenshot({ path: path.join(destino, `${nome}-${width}.png`) });
      }
      await p.setViewportSize({ width: 390, height: 844 });
      if (nome === 'comprador') {
        await p.setViewportSize({ width: 320, height: 568 });
        await barra.getByRole('link', { name: 'Encomendas', exact: true }).click();
        await expect(barra.getByRole('link', { name: 'Encomendas', exact: true })).toHaveAttribute('aria-current', 'page');
        assert.ok(await barra.getByRole('link', { name: 'Encomendas', exact: true }).evaluate(e => {
          const r = document.createRange(); r.selectNodeContents(e.querySelector('.barra-mobile__rotulo'));
          return r.getBoundingClientRect().width <= e.getBoundingClientRect().width;
        }));
        await p.setViewportSize({ width: 390, height: 844 });
      }
      await barra.getByRole('link', { name: 'Produtos', exact: true }).click();
      await expect(barra.getByRole('link', { name: 'Produtos', exact: true })).toHaveAttribute('aria-current', 'page');
      await p.goto(`${base}/produtos/p1`);
      await expect(barra.getByRole('link', { name: 'Produtos', exact: true })).toHaveAttribute('aria-current', 'page');
      await p.goto(`${base}/produtores/horta-ribeira`);
      await expect(barra.getByRole('link', { name: 'Produtos', exact: true })).toHaveAttribute('aria-current', 'page');
      if (utilizador) {
        await barra.getByRole('link', { name: 'Perfil', exact: true }).click();
        await p.getByRole('button', { name: 'Terminar sessão' }).click();
        await expect(p.getByRole('link', { name: 'Criar conta', exact: true })).toBeVisible();
        assert.deepEqual(await barra.locator('.barra-mobile__rotulo').allTextContents(), ['Leilões', 'Produtos', 'Perfil']);
        assert.equal(await p.evaluate(() => localStorage.getItem('sessao')), null);
      }
      assert.deepEqual(erros, []);
      await contexto.close();
    }

    const contexto = await contextoTeste(browser, null);
    const p = await contexto.newPage();
    await p.goto(`${base}/perfil`);
    await p.getByRole('link', { name: 'Entrar', exact: true }).click();
    await expect(p.getByRole('link', { name: 'Voltar ao perfil', exact: true })).toBeVisible();
    await p.setViewportSize({ width: 1440, height: 844 });
    await expect(p.getByRole('link', { name: 'Voltar ao perfil', exact: true })).toBeHidden();
    await p.setViewportSize({ width: 390, height: 844 });
    await p.getByRole('link', { name: 'Voltar ao perfil', exact: true }).click();
    await p.waitForURL('**/perfil');
    await p.getByRole('link', { name: 'Entrar', exact: true }).click();
    await expect(p.locator('.barra-mobile a[aria-current=page]')).toHaveText('Perfil');
    await p.locator('#email').fill('comprador@teste.exemplo.pt');
    await p.locator('#password').fill('password-de-teste');
    await p.locator('form button[type=submit]').click();
    await p.waitForURL('**/perfil');
    await expect(p.getByText('Comprador de teste', { exact: true })).toBeVisible();
    await p.getByRole('button', { name: 'Terminar sessão' }).click();
    await p.getByRole('link', { name: 'Criar conta', exact: true }).click();
    await expect(p.getByRole('link', { name: 'Voltar ao perfil', exact: true })).toBeVisible();
    await p.setViewportSize({ width: 1440, height: 844 });
    await expect(p.getByRole('link', { name: 'Voltar ao perfil', exact: true })).toBeHidden();
    await p.setViewportSize({ width: 390, height: 844 });
    await p.getByRole('link', { name: 'Voltar ao perfil', exact: true }).click();
    await p.waitForURL('**/perfil');
    await p.getByRole('link', { name: 'Criar conta', exact: true }).click();
    await expect(p.locator('.barra-mobile a[aria-current=page]')).toHaveText('Perfil');
    await p.locator('#nome').fill('Nova conta de teste');
    await p.locator('#email').fill('nova@teste.exemplo.pt');
    await p.locator('#password').fill('password-de-teste');
    await p.locator('form button[type=submit]').click();
    await p.waitForURL('**/perfil');
    await expect(p.getByText('Nova conta de teste', { exact: true })).toBeVisible();

    await p.goto(`${base}/registo`);
    await p.setViewportSize({ width: 320, height: 568 });
    await p.selectOption('#papel', 'produtor');
    await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const fim = await p.locator('form button[type=submit]').boundingBox();
    const nav = await p.locator('.barra-mobile').boundingBox();
    assert.ok(fim.y + fim.height < nav.y, 'A barra não pode tapar o botão no fim do formulário');
    await p.evaluate(() => {
      const toast = document.createElement('div'); toast.textContent = 'Notificação de teste';
      document.querySelector('.notificacoes').appendChild(toast);
    });
    const toast = await p.locator('.notificacoes').boundingBox();
    assert.ok(toast.y + toast.height <= nav.y, 'As notificações devem ficar acima da barra');
    await contexto.close();
    console.log('PASS: opções por papel, perfil aprovado/pendente, logout, login/registo com regresso ao perfil, estados ativos, contador, 320–1440 px, conteúdo e notificações sem sobreposição.');
    console.log(destino);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

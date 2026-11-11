const assert = require('node:assert/strict');
const path = require('node:path');
const { expect } = require('@playwright/test');
const Product = require('../../src/models/Product');

module.exports = async ({ browser, verificar, apiUrl, webUrl, pasta, erros }) => {
  const comprador = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const produtor = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await comprador.newPage(), vendedor = await produtor.newPage();
  for (const pagina of [p, vendedor]) pagina.on('pageerror', e => erros.push(e.message));
  const sino = () => p.getByRole('button', { name: /^Notificações/ });
  const painel = () => p.getByRole('dialog', { name: 'Notificações', exact: true });
  async function login(pagina, email, destino) {
    await pagina.goto(webUrl + '/login');
    await pagina.getByLabel('Email', { exact: true }).fill(email);
    await pagina.getByLabel('Password', { exact: true }).fill('password123');
    await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(pagina).toHaveURL(webUrl + destino);
    await expect(pagina.getByRole('button', { name: 'Notificações', exact: true })).toBeVisible();
  }
  try {
    await login(vendedor, 'horta@exemplo.pt', '/produtor');
    await expect(vendedor.getByTestId('por-tratar')).not.toHaveText('A carregar…');
    await login(p, 'tasca@exemplo.pt', '/');
    await expect(p.locator('.cartao-produto').first()).toBeVisible();
    await verificar('Notificações: evento real, histórico após o aviso e persistência após F5', async () => {
      const kiwi = await Product.findOne({ nome: 'Kiwi Hayward' });
      const token = await p.evaluate(() => JSON.parse(localStorage.getItem('sessao')).token);
      const tokenProdutor = await vendedor.evaluate(() => JSON.parse(localStorage.getItem('sessao')).token);
      const resposta = await comprador.request.post(apiUrl + '/api/orders', {
        headers: { Authorization: 'Bearer ' + token },
        data: { linhas: [{ produto: kiwi.id, quantidade: 1 }], entrega: { tipo: 'levantamento' } }
      });
      assert.equal(resposta.status(), 201);
      const [pedido] = await resposta.json();
      await expect(vendedor.getByRole('status').filter({ hasText: 'Recebeu uma nova encomenda.' })).toBeVisible();
      const atualizada = await produtor.request.patch(apiUrl + '/api/orders/' + pedido._id + '/estado', {
        headers: { Authorization: 'Bearer ' + tokenProdutor }, data: { estado: 'confirmada' }
      });
      assert.equal(atualizada.status(), 200);
      const aviso = p.locator('.notificacoes .toast').filter({ hasText: 'marcou a sua encomenda' });
      await expect(aviso).toBeVisible();
      await expect(sino()).toHaveAccessibleName('Notificações, 1 por ler');
      const pronta = await produtor.request.patch(apiUrl + '/api/orders/' + pedido._id + '/estado', {
        headers: { Authorization: 'Bearer ' + tokenProdutor }, data: { estado: 'pronta' }
      });
      assert.equal(pronta.status(), 200);
      await expect(sino()).toHaveAccessibleName('Notificações, 2 por ler');
      await expect(aviso).toHaveCount(0, { timeout: 16000 });
      await sino().click();
      await expect(painel()).toContainText('marcou a sua encomenda como "confirmada"');
      await expect(painel()).toContainText('Por ler');
      await p.reload();
      await expect(sino()).toHaveAccessibleName('Notificações, 2 por ler');
      await sino().click();
      await painel().getByRole('link').filter({ hasText: 'confirmada' }).click();
      await expect(p).toHaveURL(webUrl + '/encomendas');
      await expect(sino()).toHaveAccessibleName('Notificações, 1 por ler');
      await expect(painel()).toHaveCount(0);
      await sino().click();
      await painel().getByRole('button', { name: 'Marcar todas como lidas', exact: true }).click();
      await expect(sino()).toHaveAccessibleName('Notificações');
      await expect(painel().getByText('Por ler', { exact: true })).toHaveCount(0);
      await painel().getByRole('button', { name: 'Fechar lista de notificações', exact: true }).click();
      await p.reload();
      await expect(sino()).toHaveAccessibleName('Notificações');
    });
    await verificar('Notificações: painel acessível em cinco larguras e fecho por teclado', async () => {
      for (const width of [320, 375, 768, 1024, 1440]) {
        await p.setViewportSize({ width, height: 900 });
        await sino().click();
        await expect(painel()).toContainText('confirmada');
        const rect = await painel().boundingBox();
        assert(rect.x >= 0 && rect.x + rect.width <= width);
        assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await p.screenshot({ path: path.join(pasta, 'notificacoes-' + width + '.png') });
        await p.keyboard.press('Escape');
        await expect(painel()).toHaveCount(0);
        await expect(sino()).toBeFocused();
      }
      await sino().click();
      await p.locator('header .marca').click();
      await expect(painel()).toHaveCount(0);
    });
    await verificar('Notificações: histórico separado por utilizador e preservado ao voltar à conta', async () => {
      await p.goto(webUrl + '/perfil');
      await p.getByRole('button', { name: 'Terminar sessão', exact: true }).click();
      await expect(sino()).toHaveCount(0);
      await login(p, 'horta@exemplo.pt', '/produtor');
      await sino().click();
      await expect(painel()).toContainText('Ainda não recebeu notificações.');
      await p.keyboard.press('Escape');
      await p.goto(webUrl + '/perfil');
      await p.getByRole('button', { name: 'Terminar sessão', exact: true }).click();
      await login(p, 'tasca@exemplo.pt', '/');
      await sino().click();
      await expect(painel()).toContainText('confirmada');
      await expect(painel().getByText('Por ler', { exact: true })).toHaveCount(0);
    });
  } finally {
    await comprador.close();
    await produtor.close();
  }
};

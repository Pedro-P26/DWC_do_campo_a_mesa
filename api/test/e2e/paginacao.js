const { expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Product = require('../../src/models/Product');
const User = require('../../src/models/User');

module.exports = async ({ browser, verificar, webUrl, pasta, erros }) => {
  const produtor = await User.findOne({ email: 'horta@exemplo.pt' });
  const produtos = await Product.insertMany(Array.from({ length: 20 }, (_, i) => ({
    nome: `Produto de paginação ${String(i + 1).padStart(2, '0')}`,
    produtor: produtor.id, categoria: 'Outros', preco: i + 1, stock: 5, unidade: 'kg'
  })));
  try {
    for (const largura of [320, 1440]) {
      await verificar(`Paginação a ${largura}px: páginas, ordenação, pesquisa e resultados vazios`, async () => {
        const contexto = await browser.newContext({ viewport: { width: largura, height: 900 } });
        try {
          const pagina = await contexto.newPage();
          pagina.on('pageerror', e => erros.push(e.message));
          await pagina.goto(webUrl);
          const nav = pagina.getByRole('navigation', { name: 'Paginação dos produtos', exact: true });
          const cartoes = pagina.locator('.cartao-produto');
          await expect(cartoes).toHaveCount(12);
          await expect(pagina.getByText('A mostrar 1–12 de 25 produtos', { exact: true })).toBeVisible();
          await expect(nav.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
          const links = () => cartoes.locator('h3 a').evaluateAll(elementos => elementos.map(e => e.href));
          const ids = await links();
          await nav.getByRole('button', { name: 'Seguinte', exact: true }).click();
          await expect(pagina.getByRole('heading', { name: 'Produtos', exact: true })).toBeFocused();
          await expect(pagina.getByText('A mostrar 13–24 de 25 produtos', { exact: true })).toBeVisible();
          ids.push(...await links());
          await nav.getByRole('button', { name: 'Seguinte', exact: true }).click();
          await expect(cartoes).toHaveCount(1);
          ids.push(...await links());
          assert.equal(new Set(ids).size, 25);
          await expect(nav.getByRole('button', { name: 'Seguinte', exact: true })).toBeDisabled();
          assert(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await nav.scrollIntoViewIfNeeded();
          await pagina.screenshot({ path: path.join(pasta, `paginacao-${largura}.png`) });
          await pagina.getByLabel('Ordenar por', { exact: true }).selectOption('nome-asc');
          await expect(pagina.getByText('A mostrar 1–12 de 25 produtos', { exact: true })).toBeVisible();
          await nav.getByRole('button', { name: 'Seguinte', exact: true }).click();
          await pagina.getByLabel('Pesquisar produtos', { exact: true }).fill('Kiwi Hayward');
          await expect(cartoes).toHaveCount(1);
          await expect(nav).toHaveCount(0);
          await expect(pagina.getByText('A mostrar 1–1 de 1 produto', { exact: true })).toBeVisible();
          await pagina.getByLabel('Pesquisar produtos', { exact: true }).fill('Produto inexistente de paginação');
          await expect(cartoes).toHaveCount(0);
          await expect(pagina.getByText('Nenhum produto encontrado.', { exact: true })).toBeVisible();
          await pagina.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
          await expect(cartoes).toHaveCount(12);
          await expect(nav.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
          if (largura >= 768) {
            await nav.getByRole('button', { name: 'Página 3', exact: true }).click();
            await expect(nav.getByRole('button', { name: 'Página 3', exact: true })).toHaveAttribute('aria-current', 'page');
          }
        } finally { await contexto.close(); }
      });
    }
  } finally { await Product.deleteMany({ _id: { $in: produtos.map(p => p._id) } }); }
};

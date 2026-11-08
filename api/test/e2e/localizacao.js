const { expect } = require('@playwright/test');
const User = require('../../src/models/User');
const Product = require('../../src/models/Product');

module.exports = async ({ browser, verificar, webUrl, erros }) => {
  const produtor = await User.findOne({ email: 'horta@exemplo.pt' });
  const produto = await Product.findOne({ produtor: produtor.id });
  for (const largura of [375, 1440]) {
    await verificar(`Localidade sem mapas no produto e produtor a ${largura}px`, async () => {
      const contexto = await browser.newContext({ viewport: { width: largura, height: 900 } });
      try {
        const pagina = await contexto.newPage();
        pagina.on('pageerror', e => erros.push(e.message));
        for (const rota of [`/produtos/${produto.id}`, `/produtores/${produtor.id}`]) {
          await pagina.goto(`${webUrl}${rota}`);
          await expect(pagina.getByText(produtor.produtor.localidade, { exact: true }).first()).toBeVisible();
          await expect(pagina.locator('iframe')).toHaveCount(0);
          await expect(pagina.getByRole('link', { name: /Google Maps/ })).toHaveCount(0);
        }
      } finally { await contexto.close(); }
    });
  }
};

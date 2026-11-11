const { expect } = require('@playwright/test');
const User = require('../../src/models/User');
const Product = require('../../src/models/Product');

module.exports = async ({ browser, verificar, webUrl, erros }) => {
  const produtor = await User.findOne({ email: 'horta@exemplo.pt' });
  const produto = await Product.findOne({ produtor: produtor.id });
  const original = produtor.toObject().produtor.localizacao;
  try {
    for (const largura of [375, 1440]) {
      await verificar(`Mapa do produtor, edição e remoção das coordenadas a ${largura}px`, async () => {
        const contexto = await browser.newContext({ viewport: { width: largura, height: 900 } });
        try {
          const pagina = await contexto.newPage();
          pagina.on('pageerror', e => erros.push(e.message));
          await pagina.goto(`${webUrl}/produtos/${produto.id}`);
          await expect(pagina.getByText(produtor.produtor.localidade, { exact: true }).first()).toBeVisible();
          await expect(pagina.getByTitle('Mapa de ' + produtor.produtor.nomeExploracao)).toHaveAttribute('src', /q=Ponte%20de%20Lima%2C%20Portugal/);

          await pagina.goto(`${webUrl}/login`);
          await pagina.getByLabel('Email', { exact: true }).fill('horta@exemplo.pt');
          await pagina.getByLabel('Password', { exact: true }).fill('password123');
          await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
          await expect(pagina).toHaveURL(`${webUrl}/produtor`);
          await pagina.goto(`${webUrl}/produtor/perfil`);
          await pagina.getByLabel('Latitude', { exact: true }).fill('41.767');
          await pagina.getByLabel('Longitude', { exact: true }).fill('');
          await pagina.getByRole('button', { name: 'Guardar página pública', exact: true }).click();
          await expect(pagina.getByRole('alert')).toHaveText('Preencha a latitude e a longitude, ou deixe ambas vazias.');
          await pagina.getByLabel('Longitude', { exact: true }).fill('-8.583');
          await pagina.getByRole('button', { name: 'Guardar página pública', exact: true }).click();
          await expect(pagina.getByText('Página pública guardada.', { exact: true })).toBeVisible();
          const guardado = await User.findById(produtor.id);
          expect(guardado.produtor.localizacao.lat).toBe(41.767);
          expect(guardado.produtor.localizacao.lng).toBe(-8.583);

          await pagina.goto(`${webUrl}/produtores/${produtor.id}`);
          const mapa = pagina.getByTitle('Mapa de ' + produtor.produtor.nomeExploracao);
          await expect(mapa).toHaveAttribute('src', /q=41.767%2C-8.583/);
          expect(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          await pagina.goto(`${webUrl}/produtos/${produto.id}`);
          await expect(mapa).toHaveAttribute('src', /q=41.767%2C-8.583/);
          expect(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

          await pagina.goto(`${webUrl}/produtor/perfil`);
          await expect(pagina.getByLabel('Latitude', { exact: true })).toHaveValue('41.767');
          await pagina.getByLabel('Latitude', { exact: true }).fill('');
          await pagina.getByLabel('Longitude', { exact: true }).fill('');
          await pagina.getByRole('button', { name: 'Guardar página pública', exact: true }).click();
          await expect(pagina.getByText('Página pública guardada.', { exact: true })).toBeVisible();
          expect((await User.findById(produtor.id).lean()).produtor.localizacao).toBeNull();
          await pagina.goto(`${webUrl}/produtores/${produtor.id}`);
          await expect(mapa).toHaveAttribute('src', /q=Ponte%20de%20Lima%2C%20Portugal/);
          await expect(pagina.getByText('Mapa da localidade indicada pelo produtor.', { exact: true })).toBeVisible();
          await expect(pagina.getByRole('link', { name: 'Abrir no Google Maps', exact: true })).toHaveAttribute('target', '_blank');
        } finally { await contexto.close(); }
      });
    }
  } finally {
    await User.updateOne({ _id: produtor.id }, original
      ? { $set: { 'produtor.localizacao': original } }
      : { $unset: { 'produtor.localizacao': '' } });
  }
};

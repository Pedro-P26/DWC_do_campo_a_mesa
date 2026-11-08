const { expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Auction = require('../../src/models/Auction');
const User = require('../../src/models/User');

module.exports = async ({ browser, verificar, webUrl, pasta, erros }) => {
  const originais = await Auction.find().lean();
  const criados = [];
  const produtor = await User.findOne({ email: 'horta@exemplo.pt' });
  try {
    // Isolar os leilões do seed apenas nesta base temporária.
    await Auction.updateMany({}, { estado: 'agendado', iniciaEm: new Date(Date.now() + 3600000), terminaEm: new Date(Date.now() + 7200000) });
    for (const largura of [375, 1440]) {
      const contexto = await browser.newContext({ viewport: { width: largura, height: 900 } });
      try {
        const pagina = await contexto.newPage();
        pagina.on('pageerror', e => erros.push(e.message));
        const cartao = pagina.getByRole('region', { name: 'Leilão em direto', exact: true });
        await verificar(`Destaque a ${largura}px: oculto sem leilões ativos`, async () => {
          await pagina.goto(webUrl);
          await expect(pagina.locator('.cartao-produto')).toHaveCount(5);
          await expect(cartao).toHaveCount(0);
        });
        let primeiro;
        await verificar(`Destaque a ${largura}px: aparece automaticamente, mostra dados e abre a sala`, async () => {
          primeiro = await Auction.create({ produtor: produtor.id, lote: 'Lote E2E em direto', precoBase: 25, incremento: 1,
            licitacaoAtual: { valor: 25 }, estado: 'ativo', iniciaEm: new Date(Date.now() - 1000), terminaEm: new Date(Date.now() + 600000) });
          criados.push(primeiro.id);
          // Não recarregar: validar a consulta periódica real de 15 segundos.
          await expect(cartao).toBeVisible({ timeout: 20000 });
          await expect(cartao).toContainText('Lote E2E em direto');
          await expect(cartao).toContainText('Horta da Ribeira');
          await expect(cartao).toContainText('25,00');
          const relogio = cartao.getByTestId('destaque-tempo');
          const antes = await relogio.innerText();
          await expect.poll(() => relogio.innerText()).not.toBe(antes);
          assert(await pagina.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await cartao.scrollIntoViewIfNeeded();
          await pagina.screenshot({ path: path.join(pasta, `leilao-destaque-${largura}.png`) });
          await cartao.getByRole('link', { name: 'Ver leilão em direto', exact: true }).click();
          await expect(pagina).toHaveURL(`${webUrl}/login`);
          await pagina.getByLabel('Email', { exact: true }).fill('tasca@exemplo.pt');
          await pagina.getByLabel('Password', { exact: true }).fill('password123');
          await pagina.getByRole('button', { name: 'Entrar', exact: true }).click();
          await expect(pagina).toHaveURL(`${webUrl}/leiloes/${primeiro.id}`);
          await expect(pagina.getByRole('heading', { name: primeiro.lote, exact: true })).toBeVisible();
        });
        await verificar(`Destaque a ${largura}px: vários ativos destacam o que termina primeiro`, async () => {
          const maisCedo = await Auction.create({ produtor: produtor.id, lote: 'Lote E2E termina primeiro', precoBase: 40, incremento: 1,
            licitacaoAtual: { valor: 40 }, estado: 'ativo', iniciaEm: new Date(Date.now() - 1000), terminaEm: new Date(Date.now() + 300000) });
          criados.push(maisCedo.id);
          await pagina.goto(webUrl);
          await expect(cartao.getByRole('heading')).toHaveText(maisCedo.lote);
          await expect(cartao.getByRole('link')).toHaveAttribute('href', `/leiloes/${maisCedo.id}`);
          await expect(cartao).toHaveCount(1);
        });
        await verificar(`Destaque a ${largura}px: desaparece automaticamente quando os leilões terminam`, async () => {
          await Auction.updateMany({ _id: { $in: criados } }, { estado: 'terminado', terminaEm: new Date(Date.now() - 1000) });
          await expect(cartao).toHaveCount(0, { timeout: 20000 });
          await expect(pagina.locator('.cartao-produto')).toHaveCount(5);
        });
      } finally { await contexto.close(); }
    }
  } finally {
    await Auction.deleteMany({ _id: { $in: criados } });
    for (const original of originais) await Auction.replaceOne({ _id: original._id }, original);
  }
};

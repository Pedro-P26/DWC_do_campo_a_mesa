const { expect } = require('@playwright/test');
const User = require('../../src/models/User');
const Product = require('../../src/models/Product');
const Order = require('../../src/models/Order');
const Review = require('../../src/models/Review');
module.exports = async ({ spa, context, verificar, apiUrl, webUrl, errosBrowser }) => {
  const testar = (nome, acao) => verificar(nome, acao, spa);
  const dono = await User.findOne({ email: 'horta@exemplo.pt' });
  const card = id => spa.getByTestId(`produto-${id}`);
  const euro = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
  let produto;
  await testar('Painel carrega dados reais sem aviso Por implementar', async () => {
    await spa.goto(`${webUrl}/login`); await spa.getByLabel('Email', { exact: true }).fill('horta@exemplo.pt');
    await spa.getByLabel('Password', { exact: true }).fill('password123');
    await spa.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(spa.getByRole('heading', { name: 'Painel do produtor', exact: true })).toBeVisible();
    await expect(spa.getByText(/Por implementar/)).toHaveCount(0);
    const lista = await Product.find({ produtor: dono._id });
    for (const p of lista) await expect(card(p.id)).toBeVisible();
    const alheio = await Product.findOne({ produtor: { $ne: dono._id } });
    await expect(card(alheio.id)).toHaveCount(0);
  });
  await testar('Indicadores correspondem as encomendas e avaliacoes do produtor', async () => {
    const lista = await Order.find({ produtor: dono._id }); const agora = new Date();
    const vendas = lista.filter(o => o.estado !== 'pendente' && o.createdAt.getFullYear() === agora.getFullYear() && o.createdAt.getMonth() === agora.getMonth()).reduce((s, o) => s + o.total, 0);
    await expect(spa.getByTestId('vendas-mes')).toHaveText(euro(vendas));
    await expect(spa.getByTestId('por-tratar')).toHaveText(String(lista.filter(o => o.estado !== 'entregue').length));
    const reviews = await Review.find({ produtor: dono._id, visivel: true });
    await expect(spa.getByTestId('avaliacao-media')).toHaveText(reviews.length ? `${(reviews.reduce((s, r) => s + r.classificacao, 0) / reviews.length).toFixed(1)} / 5` : 'Sem avaliações');
  });
  await testar('Criar produto pelo formulario guarda campos, epocas e stock baixo', async () => {
    await spa.getByRole('button', { name: 'Novo produto', exact: true }).click();
    const f = spa.getByRole('form', { name: 'Formulário de produto' });
    await f.getByLabel('Nome', { exact: true }).fill('Produto do painel Playwright');
    await f.getByLabel('Categoria', { exact: true }).selectOption('Fruta');
    await f.getByLabel('Descrição', { exact: true }).fill('Produto criado na interface');
    await f.getByLabel('Ingredientes (separados por vírgulas)', { exact: true }).fill('Farinha de milho, Água');
    await f.getByLabel('Preço (€)', { exact: true }).fill('2.50');
    await f.getByLabel('Stock', { exact: true }).fill('3');
    await f.getByLabel('Biológico', { exact: true }).check(); await f.getByLabel('Outono', { exact: true }).check();
    const [r] = await Promise.all([spa.waitForResponse(r => r.url() === `${apiUrl}/api/products` && r.request().method() === 'POST'), f.getByRole('button', { name: 'Guardar produto', exact: true }).click()]);
    expect(r.status()).toBe(201); produto = await r.json();
    expect(produto.produtor).toBe(dono.id); expect(produto.epocas).toEqual(['Outono']); expect(produto.biologico).toBe(true);
    expect(produto.ingredientes).toEqual(['Farinha de milho', 'Água']);
    await expect(card(produto._id)).toContainText('Stock baixo');
    await expect(spa.getByTestId('stock-baixo')).toContainText('Produto do painel Playwright: 3 kg');
  });
  await testar('Pesquisar ingrediente encontra o produto criado no painel', async () => {
    await spa.goto(webUrl);
    await spa.getByLabel('Pesquisar produtos', { exact: true }).fill('Farinha de milho');
    await expect(spa.locator('.cartao-produto')).toHaveCount(1);
    await expect(spa.locator('.cartao-produto')).toContainText('Produto do painel Playwright');
    await spa.goto(`${webUrl}/produtor`);
    await expect(card(produto._id)).toBeVisible();
  });
  await testar('Editar produto altera preco e retira alerta depois de repor stock', async () => {
    await card(produto._id).getByRole('button', { name: 'Editar', exact: true }).click();
    const f = spa.getByRole('form', { name: 'Formulário de produto' });
    await f.getByLabel('Preço (€)', { exact: true }).fill('3.75'); await f.getByLabel('Stock', { exact: true }).fill('12');
    const [r] = await Promise.all([spa.waitForResponse(r => r.url() === `${apiUrl}/api/products/${produto._id}` && r.request().method() === 'PUT'), f.getByRole('button', { name: 'Guardar produto', exact: true }).click()]);
    expect(r.status()).toBe(200);
    await expect(card(produto._id)).toContainText('3,75'); await expect(card(produto._id)).toContainText('Stock: 12');
    await expect(spa.getByTestId('stock-baixo')).not.toContainText('Produto do painel Playwright');
  });
  await testar('Imagem PNG e enviada por multipart e apresentada no produto', async () => {
    const imagem = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    const [r] = await Promise.all([spa.waitForResponse(r => r.url() === `${apiUrl}/api/products/${produto._id}/imagem` && r.request().method() === 'POST'), card(produto._id).getByLabel(/Imagem \(JPEG/).setInputFiles({ name: 'produto.png', mimeType: 'image/png', buffer: imagem })]);
    expect(r.status()).toBe(200); const url = (await r.json()).imagemUrl;
    await expect(card(produto._id).getByRole('img')).toHaveAttribute('src', url);
    await expect.poll(() => card(produto._id).getByRole('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    expect((await context.request.get(url)).status()).toBe(200);
  });
  await testar('Ficheiro invalido e imagem demasiado grande sao rejeitados na interface', async () => {
    const input = card(produto._id).getByLabel(/Imagem \(JPEG/);
    await input.setInputFiles({ name: 'ficheiro.txt', mimeType: 'text/plain', buffer: Buffer.from('teste') });
    await expect(spa.getByRole('alert')).toContainText('Escolha uma imagem');
    await input.setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
    await expect(spa.getByRole('alert')).toContainText('até 5 MB');
  });
  await testar('Eliminar exige confirmacao e remove o produto da API e do painel', async () => {
    await card(produto._id).getByRole('button', { name: 'Eliminar', exact: true }).click();
    await card(produto._id).getByRole('button', { name: 'Cancelar eliminação', exact: true }).click();
    expect(await Product.exists({ _id: produto._id })).toBeTruthy();
    await card(produto._id).getByRole('button', { name: 'Eliminar', exact: true }).click();
    const [r] = await Promise.all([spa.waitForResponse(r => r.url() === `${apiUrl}/api/products/${produto._id}` && r.request().method() === 'DELETE'), card(produto._id).getByRole('button', { name: 'Confirmar eliminação', exact: true }).click()]);
    expect(r.status()).toBe(204); await expect(card(produto._id)).toHaveCount(0); expect(await Product.exists({ _id: produto._id })).toBeNull();
  });
  await testar('Avancar encomenda atualiza indicadores sem refresh', async () => {
    const o = await Order.findOne({ produtor: dono._id, estado: 'pendente' }); expect(o).toBeTruthy();
    const anteriores = Number(await spa.getByTestId('por-tratar').textContent());
    const c = spa.getByTestId(`encomenda-${o.id}`);
    const acoes = { confirmada: 'Confirmar encomenda', pronta: 'Marcar como pronta', entregue: 'Confirmar entrega' };
    for (const estado of ['confirmada', 'pronta', 'entregue']) {
      await c.getByRole('button', { name: acoes[estado], exact: true }).click();
      await expect(c.getByLabel(`Estado: ${estado}`, { exact: true })).toBeVisible();
    }
    await expect(spa.getByTestId('por-tratar')).toHaveText(String(anteriores - 1));
  });
  await testar('Conta pendente fica bloqueada; aprovação direta desbloqueia sem recarregar', async () => {
    const r = await context.request.post(`${apiUrl}/api/auth/registo`, { data: { nome: 'Produtor pendente', email: 'painel.pendente@teste.pt', password: 'password123', papel: 'produtor' } });
    expect(r.status()).toBe(201); const s = await r.json();
    const isolado = await context.browser().newContext();
    const outro = await isolado.newPage();
    outro.on('pageerror', e => errosBrowser.push(e.message));
    await outro.goto(webUrl);
    await outro.evaluate(s => localStorage.setItem('sessao', JSON.stringify(s)), s);
    await outro.goto(`${webUrl}/produtor`);
    await expect(outro.getByRole('button', { name: 'Novo produto', exact: true })).toBeDisabled();
    await expect(outro.getByText('Ainda sem produtos. Crie o primeiro produto.')).toBeVisible();
    await expect(outro.getByTestId('vendas-mes')).toHaveText(euro(0));
    await expect(outro.getByTestId('avaliacao-media')).toHaveText('Sem avaliações');
    await expect(outro.getByText(/Por implementar/)).toHaveCount(0);
    await User.updateOne({ _id: s.utilizador.id }, { $set: { 'produtor.validado': true } });
    await expect(outro.getByRole('button', { name: 'Novo produto', exact: true })).toBeEnabled();
    await expect(outro.getByRole('status').filter({ hasText: 'A sua conta de produtor foi validada.' })).toBeVisible();
    await isolado.close(); expect(errosBrowser).toEqual([]);
  });
};

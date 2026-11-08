// Checklists do guia: pp. 33, 45, 66, 79 e testes de ponta a ponta das pp. 90–91.
// UI Playwright + HTTP/Socket.io reais; o runner fornece apenas uma BD descartável.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const { once } = require('node:events');
const { expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const { io: criarSocket } = createRequire(path.resolve(__dirname, '../../../web/package.json'))('socket.io-client');
const User = require('../../src/models/User');
const Product = require('../../src/models/Product');
const Order = require('../../src/models/Order');
const Auction = require('../../src/models/Auction');
const Bid = require('../../src/models/Bid');
const Review = require('../../src/models/Review');

module.exports = async ({ browser, paginas, verificar, apiUrl, webUrl, erros, pasta, io }) => {
  const contextos = [], sockets = [];
  const diagnostico = [];
  const contexto = async () => {
    const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    contextos.push(c);
    await c.tracing.start({ screenshots: true, snapshots: true });
    c.on('page', p => {
      p.on('pageerror', e => erros.push(e.message));
      p.on('response', r => { if (r.url().startsWith(apiUrl) && r.status() >= 400) diagnostico.push({ caminho: new URL(r.url()).pathname, estado: r.status() }); });
    });
    return c;
  };
  async function login(p, email) {
    await p.goto(`${webUrl}/login`);
    await p.getByLabel('Email', { exact: true }).fill(email);
    await p.getByLabel('Password', { exact: true }).fill('password123');
    await p.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(p).not.toHaveURL(`${webUrl}/login`);
  }
  const sessao = p => p.evaluate(() => JSON.parse(localStorage.getItem('sessao')));
  const emitir = (socket, evento, dados) => socket.timeout(5000).emitWithAck(evento, dados);
  async function ligar(token) {
    const s = criarSocket(apiUrl, { auth: { token }, transports: ['websocket'], autoConnect: false });
    sockets.push(s);
    const conectado = once(s, 'connect', { signal: AbortSignal.timeout(10000) });
    s.connect(); await conectado;
    return s;
  }
  async function entrar(s, id) {
    const estado = once(s, 'estado', { signal: AbortSignal.timeout(5000) });
    s.emit('entrar', id); return (await estado)[0];
  }
  try {
    const c = await contexto(), p = await c.newPage();
    await verificar('Guia p. 66: login inválido, formulário obrigatório e respostas 401 equivalentes', async () => {
      await p.goto(`${webUrl}/login`);
      let pedidos = 0;
      p.on('request', r => { if (r.method() === 'POST' && r.url().endsWith('/auth/login')) pedidos++; });
      await p.getByRole('button', { name: 'Entrar', exact: true }).click();
      assert.equal(await p.locator('form').evaluate(f => f.checkValidity()), false);
      assert.equal(pedidos, 0);
      await p.getByLabel('Email', { exact: true }).fill('tasca@exemplo.pt');
      await p.getByLabel('Password', { exact: true }).fill('password-errada');
      await p.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(p.getByRole('alert')).toHaveText('Email ou password incorretos');
      const a = await c.request.post(`${apiUrl}/api/auth/login`, { data: { email: 'tasca@exemplo.pt', password: 'errada' } });
      const b = await c.request.post(`${apiUrl}/api/auth/login`, { data: { email: 'ausente@e2e.pt', password: 'errada' } });
      assert.equal(a.status(), 401); assert.equal(b.status(), 401); assert.deepEqual(await a.json(), await b.json());
    });
    await verificar('Guia pp. 33/66: registo pela UI, sessão após F5, papéis e logout', async () => {
      await p.goto(`${webUrl}/produtor`); await expect(p).toHaveURL(`${webUrl}/login`);
      await p.goto(`${webUrl}/registo`);
      await p.getByLabel('Nome', { exact: true }).fill('Comprador E2E');
      await p.getByLabel('Email', { exact: true }).fill('comprador.enunciado@e2e.pt');
      await p.getByLabel('Password', { exact: true }).fill('password123');
      await p.getByRole('button', { name: 'Registar', exact: true }).click();
      await expect(p).toHaveURL(`${webUrl}/`);
      await p.goto(`${webUrl}/perfil`); await p.reload();
      await expect(p.getByText('Comprador E2E', { exact: true })).toBeVisible();
      await p.goto(`${webUrl}/admin`); await expect(p).toHaveURL(`${webUrl}/`);
      await expect(p.locator('.cartao-produto').first()).toBeVisible();
      await p.locator('header').getByRole('link', { name: 'Perfil', exact: true }).click();
      await expect(p.getByText('Comprador E2E', { exact: true })).toBeVisible();
      await p.getByRole('button', { name: 'Terminar sessão', exact: true }).click();
      assert.equal(await p.evaluate(() => localStorage.getItem('sessao')), null);
      await p.goto(`${webUrl}/encomendas`); await expect(p).toHaveURL(`${webUrl}/login`);
    });
    await login(p, 'comprador.enunciado@e2e.pt');
    const comprador = await sessao(p);
    const horta = await User.findOne({ email: 'horta@exemplo.pt' });
    const kiwi = await Product.findOne({ nome: 'Kiwi Hayward' });
    await verificar('Guia pp. 33/66: carrinho e sessão persistem após F5; navegação SPA sem recarga', async () => {
      await p.goto(`${webUrl}/produtos/${kiwi.id}`);
      await p.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }).click();
      await p.evaluate(() => { window.marcadorE2E = 'documento-preservado'; });
      await p.getByRole('link', { name: 'Ver carrinho', exact: true }).click();
      assert.equal(await p.evaluate(() => window.marcadorE2E), 'documento-preservado');
      await p.reload();
      await expect(p.getByText('Kiwi Hayward', { exact: true })).toBeVisible();
      assert.equal((await sessao(p)).utilizador.id, comprador.utilizador.id);
      await p.getByRole('button', { name: 'Esvaziar carrinho', exact: true }).click();
      await p.goto(`${webUrl}/leiloes`); await p.reload();
      await expect(p.getByRole('heading', { name: 'Leilões', exact: true })).toBeVisible();
    });
    await verificar('Guia p. 66: token expirado retira a sessão e redireciona para login', async () => {
      const expirado = jwt.sign({ id: comprador.utilizador.id, papel: 'comprador' }, process.env.JWT_SECRET, { expiresIn: -10 });
      await p.addInitScript(s => {
        if (!sessionStorage.getItem('expiracao-e2e-preparada')) {
          localStorage.setItem('sessao', JSON.stringify(s));
          sessionStorage.setItem('expiracao-e2e-preparada', 'true');
        }
      }, { ...comprador, token: expirado });
      await p.goto(`${webUrl}/encomendas`);
      await expect(p).toHaveURL(`${webUrl}/login`);
      assert.equal(await p.evaluate(() => localStorage.getItem('sessao')), null);
      const r = await c.request.get(`${apiUrl}/api/orders`, { headers: { Authorization: `Bearer ${expirado}` } });
      assert.equal(r.status(), 401);
      await login(p, 'comprador.enunciado@e2e.pt');
    });
    await verificar('Guia pp. 45/66: 401 sem token, 403 por papel e 400 para ID inválido', async () => {
      const dados = { nome: 'Não criar', categoria: 'Fruta', preco: 1 };
      assert.equal((await c.request.post(`${apiUrl}/api/products`, { data: dados })).status(), 401);
      assert.equal((await c.request.post(`${apiUrl}/api/products`, { headers: { Authorization: `Bearer ${comprador.token}` }, data: dados })).status(), 403);
      assert.equal((await c.request.get(`${apiUrl}/api/products/abc`)).status(), 400);
      assert.equal((await c.request.get(`${apiUrl}/api/nao-existe`)).status(), 404);
    });
    await verificar('Guia pp. 66/91: registo de produtor pendente não permite publicar produtos', async () => {
      const cp = await contexto(), pp = await cp.newPage();
      await pp.goto(`${webUrl}/registo`);
      await pp.getByLabel('Nome', { exact: true }).fill('Quinta E2E por validar');
      await pp.getByLabel('Email', { exact: true }).fill('produtor.enunciado@e2e.pt');
      await pp.getByLabel('Password', { exact: true }).fill('password123');
      await pp.getByLabel('Tipo de conta', { exact: true }).selectOption('produtor');
      await pp.getByLabel('Nome da exploração', { exact: true }).fill('Quinta E2E');
      await pp.getByLabel('Localidade', { exact: true }).fill('Caminha');
      await pp.getByRole('button', { name: 'Registar', exact: true }).click();
      await expect(pp).toHaveURL(`${webUrl}/produtor`);
      await expect(pp.getByRole('button', { name: 'Novo produto', exact: true })).toBeDisabled();
      const conta = await sessao(pp);
      assert.equal(conta.utilizador.produtor.validado, false);
      const r = await cp.request.post(`${apiUrl}/api/products`, { headers: { Authorization: `Bearer ${conta.token}` }, data: { nome: 'Produto bloqueado E2E', categoria: 'Fruta', preco: 1 } });
      assert.equal(r.status(), 403);
      assert.equal(await Product.countDocuments({ produtor: conta.utilizador.id }), 0);
      await cp.close();
    });
    const produtor = paginas.produtor;
    let pedidoEntregue;
    await verificar('Guia pp. 69/79/91: compra notifica produtor; estados e toast chegam ao comprador', async () => {
      await produtor.goto(`${webUrl}/produtor`);
      await expect(produtor.getByTestId('por-tratar')).not.toHaveText('A carregar…');
      await p.goto(`${webUrl}/produtos/${kiwi.id}`);
      await p.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }).click();
      await p.getByRole('link', { name: 'Ver carrinho', exact: true }).click();
      const resposta = p.waitForResponse(r => r.url() === `${apiUrl}/api/orders` && r.request().method() === 'POST');
      await p.getByRole('button', { name: 'Finalizar compra', exact: true }).click();
      const criado = await resposta; assert.equal(criado.status(), 201);
      const [pedido] = await criado.json();
      pedidoEntregue = pedido;
      await expect(produtor.getByRole('status').filter({ hasText: 'Recebeu uma nova encomenda.' })).toBeVisible();
      await p.goto(`${webUrl}/encomendas`);
      const card = produtor.getByTestId(`encomenda-${pedido._id}`);
      await expect(card).toBeVisible();
      for (const [acao, estado] of [['Confirmar encomenda', 'confirmada'], ['Marcar como pronta', 'pronta'], ['Confirmar entrega', 'entregue']]) {
        await card.getByRole('button', { name: acao, exact: true }).click();
        await expect(p.getByTestId(`encomenda-${pedido._id}`).getByLabel(`Estado: ${estado}`, { exact: true })).toBeVisible();
        await expect(p.getByRole('status').filter({ hasText: `marcou a sua encomenda como "${estado}"` })).toBeVisible();
      }
      const tokenProdutor = (await sessao(produtor)).token;
      assert.equal((await c.request.patch(`${apiUrl}/api/orders/${pedido._id}/estado`, { headers: { Authorization: `Bearer ${tokenProdutor}` }, data: { estado: 'pendente' } })).status(), 409);
      assert.equal((await Order.findById(pedido._id)).estado, 'entregue');
    });
    await verificar('Guia p. 91: avaliação pela interface persiste e repetição devolve 409', async () => {
      const card = p.getByTestId(`encomenda-${pedidoEntregue._id}`);
      await card.getByLabel('O que pretende avaliar?', { exact: true }).selectOption(kiwi.id);
      await card.getByLabel('Comentário', { exact: true }).fill('Avaliação E2E após entrega.');
      await card.getByRole('button', { name: 'Enviar avaliação', exact: true }).click();
      await expect(p.getByRole('alert')).toHaveText('Avaliação enviada.');
      const r = await c.request.post(`${apiUrl}/api/reviews`, { headers: { Authorization: `Bearer ${comprador.token}` }, data: {
        encomenda: pedidoEntregue._id, produto: kiwi.id, classificacao: 5, comentario: 'Não duplicar.'
      } });
      assert.equal(r.status(), 409);
      assert.equal(await Review.countDocuments({ encomenda: pedidoEntregue._id, produto: kiwi.id }), 1);
    });
    let leilao;
    await verificar('Enunciado p. 11: produtor cria um leilão pelo formulário', async () => {
      await produtor.goto(`${webUrl}/produtor/leiloes/novo`);
      await produtor.getByLabel('Lote', { exact: true }).fill('Lote E2E do enunciado');
      await produtor.getByLabel('Produto', { exact: true }).selectOption(kiwi.id);
      await produtor.getByLabel('Preço base (€)', { exact: true }).fill('100');
      await produtor.getByLabel('Incremento (€)', { exact: true }).fill('5');
      await produtor.getByLabel('Duração (minutos)', { exact: true }).fill('30');
      const resposta = produtor.waitForResponse(r => r.url() === `${apiUrl}/api/auctions` && r.request().method() === 'POST');
      await produtor.getByRole('button', { name: 'Criar leilão', exact: true }).click();
      const r = await resposta; assert.equal(r.status(), 201); leilao = await r.json();
      await expect(produtor).toHaveURL(`${webUrl}/leiloes/${leilao._id}`);
      await expect(produtor.getByRole('heading', { name: leilao.lote, exact: true })).toBeVisible();
      assert.equal(leilao.produtor, horta.id);
      await produtor.goto(`${webUrl}/perfil`);
    });
    const c2 = await contexto(), p2 = await c2.newPage();
    await login(p2, 'tasca@exemplo.pt');
    const segundo = await sessao(p2);
    await Promise.all([p.goto(`${webUrl}/leiloes/${leilao._id}`), p2.goto(`${webUrl}/leiloes/${leilao._id}`)]);
    await expect(p.getByText('2 a assistir', { exact: true })).toBeVisible();
    const s1 = await ligar(comprador.token), s2 = await ligar(segundo.token);
    await entrar(s1, leilao._id); await entrar(s2, leilao._id);
    await verificar('Guia pp. 79/90: duas licitações Socket.io simultâneas de 105 aceitam só uma', async () => {
      const respostas = await Promise.all([emitir(s1, 'licitar', { leilaoId: leilao._id, valor: 105 }), emitir(s2, 'licitar', { leilaoId: leilao._id, valor: 105 })]);
      assert.equal(respostas.filter(r => r.ok).length, 1);
      assert.match(respostas.find(r => !r.ok).erro, /Licitação mínima/);
      assert.equal(await Bid.countDocuments({ leilao: leilao._id }), 1);
      for (const pagina of [p, p2]) {
        await expect(pagina.getByTestId('valor-atual')).toContainText('105,00');
        await expect(pagina.locator('ol li')).toHaveCount(1);
      }
    });
    await verificar('Guia p. 91: rajada de dez propostas mantém aceites, histórico e incremento coerentes', async () => {
      const respostas = await Promise.all(Array.from({ length: 10 }, (_, i) => emitir(i % 2 ? s1 : s2, 'licitar', { leilaoId: leilao._id, valor: 110 + i * 5 })));
      const aceites = 1 + respostas.filter(r => r.ok).length;
      const bids = await Bid.find({ leilao: leilao._id }).sort({ valor: 1 });
      assert.equal(bids.length, aceites);
      for (let i = 1; i < bids.length; i++) assert(bids[i].valor >= bids[i - 1].valor + 5);
      const atual = await Auction.findById(leilao._id);
      assert.equal(atual.numLicitacoes, aceites); assert.equal(atual.licitacaoAtual.valor, bids.at(-1).valor);
      await expect(p.locator('ol li')).toHaveCount(aceites);
      await expect(p2.locator('ol li')).toHaveCount(aceites);
      const abaixo = await emitir(s1, 'licitar', { leilaoId: leilao._id, valor: atual.licitacaoAtual.valor });
      assert.equal(abaixo.ok, false); assert.match(abaixo.erro, /Licitação mínima/);
      // Confirma que uma submissão que contorna a validação HTML também é recusada na UI.
      await p.getByLabel(/^O seu valor/).fill(String(atual.licitacaoAtual.valor));
      await p.locator('aside form').evaluate(f => { f.noValidate = true; f.requestSubmit(); });
      await expect(p.getByRole('alert')).toContainText('Licitação mínima');
      assert.equal(await Bid.countDocuments({ leilao: leilao._id }), aceites);
    });
    await verificar('Enunciado p. 21: salas isoladas e licitação fora da sala recusada', async () => {
      const outro = await Auction.create({ produtor: horta.id, lote: 'Sala isolada E2E', precoBase: 10, incremento: 1, licitacaoAtual: { valor: 10 }, estado: 'ativo', iniciaEm: new Date(Date.now() - 1000), terminaEm: new Date(Date.now() + 600000) });
      const observador = await ligar(segundo.token);
      await entrar(observador, outro.id);
      const recebidas = []; observador.on('nova-licitacao', b => recebidas.push(b));
      const fora = await emitir(observador, 'licitar', { leilaoId: leilao._id, valor: 1000 });
      assert.equal(fora.ok, false); assert.match(fora.erro, /Entre na sala/);
      const atual = await Auction.findById(leilao._id);
      assert.equal((await emitir(s1, 'licitar', { leilaoId: leilao._id, valor: atual.licitacaoAtual.valor + 5 })).ok, true);
      // Uma mensagem de estado delimita a observação sem espera fixa arbitrária.
      await entrar(observador, outro.id);
      assert.deepEqual(recebidas, []);
      observador.disconnect();
    });
    s1.disconnect(); s2.disconnect();
    await verificar('Enunciado pp. 21/22: reconexão recupera o estado e fechar janela reduz presença', async () => {
      await expect(p.getByText('2 a assistir', { exact: true })).toBeVisible();
      // A sala pessoal também pode conter transportes de páginas que acabaram de navegar.
      // Fecha especificamente o transporte da janela que está neste leilão.
      const socketsDaJanela = async () => (await io.in(`leilao:${leilao._id}`).fetchSockets())
        .filter(s => s.user.id === comprador.utilizador.id);
      await expect.poll(async () => (await socketsDaJanela()).length).toBe(1);
      const ligados = await socketsDaJanela();
      assert.equal(ligados.length, 1);
      // Fecha o transporte real para exercitar a reconexão automática do cliente.
      ligados[0].conn.close();
      await expect(p.getByRole('status').filter({ hasText: 'Ligação ativa' })).toBeVisible({ timeout: 10000 });
      await expect(p.getByText('2 a assistir', { exact: true })).toBeVisible({ timeout: 10000 });
      const bids = await Bid.find({ leilao: leilao._id });
      await expect(p.locator('ol li')).toHaveCount(bids.length);
      await p2.close();
      await expect(p.getByText('1 a assistir', { exact: true })).toBeVisible();
    });
    await verificar('Guia pp. 79/91: fecho anuncia vencedor e encomenda na interface', async () => {
      const antes = await Auction.findById(leilao._id);
      const idVencedor = String(antes.licitacaoAtual.comprador);
      await Auction.updateOne({ _id: leilao._id }, { terminaEm: new Date(Date.now() - 1000) });
      await expect(p.getByText(/Leilão terminado\. Vencedor:/)).toBeVisible({ timeout: 10000 });
      await expect(p.getByTestId('contagem')).toContainText(/Leilão encerrado:\s*Terminado/);
      const encomendas = await Order.find({ leilao: leilao._id }); assert.equal(encomendas.length, 1);
      assert.equal(String(encomendas[0].comprador), idVencedor);
      const vencedor = idVencedor === comprador.utilizador.id ? p : await c2.newPage();
      await vencedor.goto(`${webUrl}/encomendas`);
      await expect(vencedor.getByTestId(`encomenda-${encomendas[0].id}`)).toBeVisible();
      await vencedor.screenshot({ path: path.join(pasta, 'enunciado-encomenda-vencedor.png'), fullPage: true });
    });
  } catch (err) {
    console.error('Respostas HTTP de diagnóstico (sem tokens):', diagnostico);
    throw err;
  } finally {
    sockets.forEach(s => s.disconnect());
    await Promise.all(contextos.map(async (c, i) => {
      await c.tracing.stop({ path: path.join(pasta, `enunciado-trace-${i}.zip`) }).catch(() => {});
      await c.close();
    }));
  }
};

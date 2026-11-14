// Demonstração autorizada na BD configurada. Não executa seeds nem apaga dados.
const path = require('node:path');
const fs = require('node:fs/promises');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { chromium, expect } = require('@playwright/test');
const { Server } = require('socket.io');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const User = require('../../src/models/User');
const Product = require('../../src/models/Product');
const Order = require('../../src/models/Order');
const Auction = require('../../src/models/Auction');
const Review = require('../../src/models/Review');
const raiz = path.resolve(__dirname, '../../..');
const destino = path.join(raiz, 'api/test-results/demonstracao-video-v2');
const pausa = ms => new Promise(r => setTimeout(r, ms));
let browser, vite, php, io, parar, validacao, gravador, video, contextoVideo, fontes = [], legenda = '', capturar = false, capturando;
const etapas = [], criados = [];
async function main() {
  await fs.mkdir(destino, { recursive: true });
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    const marca = Date.now().toString(36), password = randomBytes(12).toString('hex');
    const hash = await bcrypt.hash(password, 10);
    async function conta(nome, papel, extra = {}) {
      const u = await User.create({ nome, email: `video.${papel}.${marca}.${criados.length}@exemplo.pt`, passwordHash: hash, papel, ...extra });
      criados.push({ tipo: 'utilizador', id: u.id, nome }); return u;
    }
    const a = await conta('Tasca do Lima · demonstração', 'comprador');
    const b = await conta('Ana Silva · demonstração', 'comprador');
    const prod = await conta('Horta · demonstração', 'produtor', { produtor: { nomeExploracao: 'Horta da Ribeira · vídeo', localidade: 'Ponte de Lima', localizacao: { lat: 41.767, lng: -8.583 }, validado: true } });
    const admin = await conta('Administração · demonstração', 'admin');
    const pendente = await conta('Quinta do Vale · vídeo', 'produtor', { produtor: { nomeExploracao: 'Quinta do Vale', localidade: 'Caminha' } });
    const imagem = await Product.findOne({ nome: /^Kiwi Hayward$/i, imagemUrl: { $exists: true, $ne: '' } }).select('imagemUrl');
    const produto = await Product.create({ produtor: prod._id, nome: 'Kiwi da colheita · demonstração', categoria: 'Fruta', descricao: 'Kiwi fresco do Alto Minho. Lote reservado para a demonstração académica.', preco: 2.4, unidade: 'kg', stock: 50, biologico: true, epocas: ['Outono'], imagemUrl: imagem?.imagemUrl });
    criados.push({ tipo: 'produto', id: produto.id });
    const entregue = await Order.create({ comprador: a._id, produtor: prod._id, linhas: [{ produto: produto._id, nome: produto.nome, precoUnit: 2.4, quantidade: 1, unidade: 'kg' }], estado: 'entregue' });
    const review = await Review.create({ autor: a._id, produtor: prod._id, encomenda: entregue._id, classificacao: 3, comentario: 'Avaliação de demonstração para moderação.', denuncias: 1 });
    criados.push({ tipo: 'encomenda inicial', id: entregue.id }, { tipo: 'avaliação', id: review.id });
    const app = require('../../src/app');
    const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    const apiUrl = `http://127.0.0.1:${server.address().port}`;
    io = new Server(server, { cors: { origin: (origem, cb) => cb(null, !origem || origem === process.env.CLIENT_URL) } });
    app.set('io', io); require('../../src/sockets')(io);
    validacao = await require('../../src/services/validacaoProdutores')(io);
    const { createServer } = await import(pathToFileURL(path.join(raiz, 'web/node_modules/vite/dist/node/index.js')).href);
    vite = await createServer({ root: path.join(raiz, 'web'), server: { host: '127.0.0.1', port: 5196 }, define: { 'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl), 'import.meta.env.VITE_USAR_DADOS_SIMULADOS': '"false"' } });
    await vite.listen(); const webUrl = vite.resolvedUrls.local[0].replace(/\/$/, ''); process.env.CLIENT_URL = webUrl;
    const phpPort = 8196, laravel = `http://127.0.0.1:${phpPort}`;
    php = spawn('php', ['-S', `127.0.0.1:${phpPort}`, '-t', 'public'], { cwd: path.join(raiz, 'admin'), windowsHide: true, stdio: 'ignore', env: { ...process.env, APP_ENV: 'local', APP_DEBUG: 'false', APP_KEY: `base64:${randomBytes(32).toString('base64')}`, APP_URL: laravel, DB_CONNECTION: 'mongodb', MONGODB_DATABASE: mongoose.connection.name, API_URL: apiUrl, SESSION_DRIVER: 'file', SESSION_COOKIE: `video_${marca}`, STORAGE_HEALTH_URL: '' } });
    for (let i = 0; i < 100; i++) { if (await fetch(`${laravel}/up`).then(r => r.ok).catch(() => false)) break; await pausa(100); }
    browser = await chromium.launch({ headless: false, slowMo: 160, args: ['--window-size=1440,1000'] });
    async function pagina() { const c = await browser.newContext({ viewport: { width: 1280, height: 820 } }); c.setDefaultTimeout(15000); c.setDefaultNavigationTimeout(30000); const p = await c.newPage(); const navegar = p.goto.bind(p); p.goto = (url, opcoes = {}) => navegar(url, { waitUntil: 'domcontentloaded', ...opcoes }); return p; }
    const visitante = await pagina(), comprador = await pagina(), segundo = await pagina(), produtor = await pagina(), administrador = await pagina(), backoffice = await pagina();
    const identidades = new Map([
      [visitante, { nome: 'Visitante', papel: 'Sem autenticação', email: 'Consulta pública' }],
      [comprador, { nome: a.nome, papel: 'Comprador 1', email: a.email }],
      [segundo, { nome: b.nome, papel: 'Comprador 2', email: b.email }],
      [produtor, { nome: prod.nome, papel: 'Produtor', email: prod.email }],
      [administrador, { nome: admin.nome, papel: 'Administrador React', email: admin.email }],
      [backoffice, { nome: admin.nome, papel: 'Administrador Laravel', email: admin.email }]
    ]);
    async function login(p, u, base = webUrl) { await p.goto(`${base}/login`); await p.getByLabel('Email', { exact: true }).fill(u.email); await p.getByLabel('Password', { exact: true }).fill(password); await p.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(p).not.toHaveURL(/\/login$/); }
    await visitante.goto(webUrl);
    // Aquecimento e autenticação antes da gravação; nenhuma credencial aparece no vídeo.
    await login(comprador, a); await login(segundo, b); await login(produtor, prod); await login(administrador, admin); await login(backoffice, admin, laravel);
    contextoVideo = await browser.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: destino, size: { width: 1920, height: 1080 } } });
    gravador = await contextoVideo.newPage(); video = gravador.video();
    await gravador.setContent(`<html><style>*{box-sizing:border-box}body{margin:0;background:#f6f2ea;font-family:Arial;color:#22452b}header{height:100px;padding:18px 36px;background:#22452b;color:white}h1{margin:0;font-size:28px}p{margin:9px 0;font-size:21px}main{height:930px;display:flex;align-items:center;justify-content:center;gap:18px;padding:12px 24px}section{min-width:0;width:100%;max-height:100%;background:#fff;border:1px solid #d2dccd;border-radius:10px;overflow:hidden}.identidade{height:82px;padding:12px 18px;background:#e6eddf;border-bottom:1px solid #cbd8c3}.identidade strong{font-size:24px}.identidade b{float:right;background:#22452b;color:white;padding:6px 12px;border-radius:6px;font-size:19px}.identidade small{display:block;margin-top:7px;font-size:16px}img{display:block;width:100%;max-height:790px;object-fit:contain}footer{font-size:17px;padding:0 36px}</style><header><h1>Do Campo à Mesa</h1><p id="titulo">Demonstração da aplicação</p></header><main id="vistas"></main><footer>MongoDB atual · React, Express, Socket.io e Laravel · Contas identificadas em cada vista · Sem áudio</footer></html>`);
    capturar = true;
    capturando = (async () => { while (capturar) { try { const atuais = [...fontes]; const titulo = legenda; const imgs = await Promise.all(atuais.map(async p => ({ imagem: (await p.screenshot({ type: 'jpeg', quality: 85 })).toString('base64'), ...identidades.get(p) }))); await gravador.evaluate(({ imgs, titulo }) => { document.querySelector('#titulo').textContent = titulo; const raiz = document.querySelector('#vistas'); raiz.replaceChildren(); for (const i of imgs) { const secao = document.createElement('section'); secao.style.width = imgs.length === 2 ? '49%' : '84%'; const identidade = document.createElement('div'); identidade.className = 'identidade'; const papel = document.createElement('b'); papel.textContent = i.papel; const nome = document.createElement('strong'); nome.textContent = i.nome; const email = document.createElement('small'); email.textContent = i.email; identidade.append(papel, nome, email); const img = document.createElement('img'); img.src = 'data:image/jpeg;base64,' + i.imagem; secao.append(identidade, img); raiz.append(secao); } }, { imgs, titulo }); } catch {} await pausa(350); } })();
    const inicio = Date.now();
    async function cena(titulo, paginas, acao, minimo = 13000) { legenda = titulo.replace(/[—–]/g, '·'); fontes = paginas; await paginas[0].bringToFront(); const t = Date.now(); console.log(`CENA ${legenda}`); await acao(); await pausa(Math.max(0, minimo - (Date.now() - t))); etapas.push({ titulo: legenda, segundo: Math.round((t-inicio)/1000), contas: paginas.map(p => identidades.get(p)) }); if (Date.now()-inicio > 292000) throw new Error('Demonstração excedeu a margem prevista para 5 minutos.'); }
    await cena('1/6 · Visitante — catálogo, filtros e origem dos produtos', [visitante], async () => { await pausa(3500); await visitante.goto(`${webUrl}/produtos/${produto.id}`); await expect(visitante.getByRole('heading', { name: produto.nome, exact: true })).toBeVisible(); await pausa(3000); await visitante.getByRole('link', { name: prod.nome, exact: true }).first().click().catch(() => {}); });
    await cena('2/6 · Comprador — adicionar ao carrinho e criar uma encomenda', [comprador], async () => { await comprador.goto(`${webUrl}/produtos/${produto.id}`); await pausa(2500); await comprador.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }).click(); await comprador.goto(`${webUrl}/carrinho`); await pausa(3500); await comprador.getByRole('button', { name: 'Finalizar compra', exact: true }).click(); await expect(comprador.getByText(/Compra concluída/)).toBeVisible(); }, 18000);
    const compra = await Order.findOne({ comprador: a._id, produtor: prod._id, estado: 'pendente' }).sort({ createdAt: -1 }); criados.push({ tipo: 'compra', id: compra.id });
    await cena('3/6 · Produtor — confirmar, preparar e entregar; comprador recebe atualizações', [produtor, comprador], async () => { await produtor.reload(); await comprador.goto(`${webUrl}/encomendas`); const card = produtor.getByTestId(`encomenda-${compra.id}`); await card.scrollIntoViewIfNeeded(); await comprador.getByTestId(`encomenda-${compra.id}`).scrollIntoViewIfNeeded(); for (const nome of ['Confirmar encomenda', 'Marcar como pronta', 'Confirmar entrega']) { await pausa(3500); await card.getByRole('button', { name: nome, exact: true }).click(); } }, 21000);
    await cena('3/6 · Produtor — publicar um leilão de 1 minuto', [produtor], async () => { await produtor.goto(`${webUrl}/produtor/leiloes/novo`); await produtor.getByLabel('Lote', { exact: true }).fill('20 kg de kiwi · demonstração em direto'); await produtor.getByLabel('Produto', { exact: true }).selectOption(produto.id); await produtor.getByLabel('Descrição', { exact: true }).fill('Colheita do Alto Minho. Levantamento na exploração.'); await produtor.getByLabel('Quantidade do lote').fill('20 kg'); await produtor.getByLabel('Preço base (€)', { exact: true }).fill('100'); await produtor.getByLabel('Incremento (€)', { exact: true }).fill('5'); await produtor.getByLabel('Duração (minutos)', { exact: true }).fill('1'); await produtor.getByRole('button', { name: 'Criar leilão', exact: true }).click(); await expect(produtor).toHaveURL(/\/leiloes\//); }, 15000);
    const leilaoId = produtor.url().split('/').at(-1); criados.push({ tipo: 'leilao', id: leilaoId });
    // Ciclo normal do servidor: inicia depois de os cenários de compra estarem preparados.
    parar = require('../../src/services/cicloLeiloes')(io);
    await produtor.goto(`${webUrl}/produtor`);
    await cena('4/6 · Leilão em direto — dois compradores, sessões independentes', [comprador, segundo], async () => { await Promise.all([comprador.goto(`${webUrl}/leiloes/${leilaoId}`), segundo.goto(`${webUrl}/leiloes/${leilaoId}`)]); await expect(comprador.getByText('2 a assistir', { exact: true })).toBeVisible(); await pausa(4000); await comprador.getByRole('button', { name: 'Licitar', exact: true }).click(); await expect(segundo.getByTestId('valor-atual')).toContainText('105'); await pausa(4000); await segundo.getByRole('button', { name: 'Licitar', exact: true }).click(); await expect(comprador.getByTestId('valor-atual')).toContainText('110'); await pausa(4000); await comprador.getByRole('button', { name: 'Licitar', exact: true }).click(); await expect(segundo.getByTestId('valor-atual')).toContainText('115'); }, 22000);
    await cena('4/6 · O tempo termina — vencedor anunciado nas duas janelas', [comprador, segundo], async () => { await expect(comprador.getByText(/Leilão terminado\. Vencedor:/)).toBeVisible({ timeout: 65000 }); await expect(segundo.getByText(/Leilão terminado\. Vencedor:/)).toBeVisible(); await pausa(4000); }, 10000);
    await cena('4/6 · Encomenda do vencedor criada automaticamente', [comprador], async () => { await comprador.getByRole('link', { name: 'Ver encomenda do leilão', exact: true }).click(); const o = await Order.findOne({ leilao: leilaoId }); if (!o) throw new Error('Encomenda do leilão em falta'); criados.push({ tipo: 'encomenda leilao', id: o.id }); await expect(comprador.getByTestId(`encomenda-${o.id}`)).toBeVisible(); });
    await cena('5/6 · Administrador React — indicadores e aprovação de produtores', [administrador], async () => { await administrador.reload(); await pausa(4000); const botao = administrador.getByRole('button', { name: `Aprovar produtor ${pendente.nome}`, exact: true }); if (await botao.count()) { await botao.scrollIntoViewIfNeeded(); await pausa(2000); await botao.click(); } }, 15000);
    await cena('6/6 · Backoffice Laravel — visão geral e serviços', [backoffice], async () => { await backoffice.reload(); await expect(backoffice.getByRole('heading', { name: 'Visão geral' })).toBeVisible(); }, 12000);
    await cena('6/6 · Laravel — produtores e moderação de avaliações', [backoffice], async () => { await backoffice.getByRole('link', { name: 'Produtores', exact: true }).click(); await pausa(4000); await backoffice.getByRole('link', { name: 'Moderação', exact: true }).click(); const r = backoffice.locator(`[data-avaliacao="${review.id}"]`); if (await r.count()) { await r.scrollIntoViewIfNeeded(); await pausa(2500); await r.getByRole('button', { name: 'Ocultar', exact: true }).click(); } }, 15000);
    await cena('6/6 · Laravel — utilizadores, encomendas e leilões', [backoffice], async () => { for (const nome of ['Utilizadores', 'Encomendas', 'Leilões']) { await backoffice.getByRole('link', { name: nome, exact: true }).click(); await pausa(3500); } }, 15000);
    await cena('Funcionalidades adicionais · Pesquisa e filtros combinados', [visitante], async () => {
      await visitante.goto(webUrl); await visitante.getByLabel('Pesquisar produtos', { exact: true }).fill('kiwi');
      await visitante.getByLabel('Pesquisar produtos', { exact: true }).scrollIntoViewIfNeeded(); await pausa(2500);
      const mais = visitante.getByRole('button', { name: /Mais filtros/ }); if (await mais.isVisible()) await mais.click();
      await visitante.getByLabel('Preço máximo (€)', { exact: true }).fill('3');
      await visitante.getByLabel('Modo biológico', { exact: true }).selectOption('Biologico');
      await expect(visitante.locator('.cartao-produto').filter({ has: visitante.locator(`a[href="/produtos/${produto.id}"]`) }).getByRole('heading', { name: produto.nome, exact: true })).toBeVisible();
    }, 14000);
    await cena('Funcionalidades adicionais · Exploração e localização no mapa', [visitante], async () => {
      await visitante.goto(`${webUrl}/produtores/${prod.id}`); await pausa(2500);
      const mapa = visitante.getByRole('region', { name: 'Localização da exploração', exact: true }); await mapa.scrollIntoViewIfNeeded();
      await expect(mapa.getByRole('link', { name: 'Abrir no Google Maps' })).toBeVisible();
    }, 12000);
    let novaReview;
    await cena('Funcionalidades adicionais · Avaliar o produto após receber a encomenda', [comprador], async () => {
      await comprador.goto(`${webUrl}/encomendas`); const c = comprador.getByTestId(`encomenda-${compra.id}`);
      await c.getByLabel('O que pretende avaliar?').selectOption(produto.id);
      await c.getByLabel('Classificação', { exact: true }).selectOption('5');
      await c.getByLabel('Comentário', { exact: true }).fill('Kiwi fresco, boa qualidade e levantamento pontual.');
      await pausa(2000); await c.getByRole('button', { name: 'Enviar avaliação', exact: true }).click();
      await expect(comprador.getByRole('alert')).toContainText('Avaliação enviada.');
      novaReview = await Review.findOne({ encomenda: compra._id, produto: produto._id });
      if (!novaReview) throw new Error('A avaliação submetida não foi guardada.'); criados.push({ tipo: 'avaliação do produto', id: novaReview.id });
    }, 15000);
    await cena('Funcionalidades adicionais · Outro comprador denuncia a avaliação', [segundo], async () => {
      await segundo.goto(`${webUrl}/produtos/${produto.id}`); const c = segundo.getByTestId(`avaliacao-${novaReview.id}`);
      await c.scrollIntoViewIfNeeded(); await pausa(2500); await c.getByRole('button', { name: 'Denunciar avaliação', exact: true }).click();
      await expect(c.getByRole('status')).toContainText('Denúncia enviada');
    }, 10000);
    await cena('Funcionalidades adicionais · Laravel analisa e resolve a denúncia', [backoffice], async () => {
      await backoffice.goto(`${laravel}/moderacao?estado=denunciadas`); const c = backoffice.locator(`[data-avaliacao="${novaReview.id}"]`);
      await expect(c).toBeVisible(); await c.scrollIntoViewIfNeeded(); await pausa(2000);
      await c.getByRole('button', { name: 'Manter e resolver denúncias', exact: true }).click();
      if ((await Review.findById(novaReview.id)).denuncias !== 0) throw new Error('Denúncia não resolvida.');
    }, 10000);
    await cena('Funcionalidades adicionais · Histórico de notificações e marcar como lidas', [comprador], async () => {
      await comprador.evaluate(() => window.scrollTo(0, 0)); await comprador.getByRole('button', { name: /^Notificações/ }).click();
      await expect(comprador.getByRole('dialog', { name: 'Notificações', exact: true })).toBeVisible(); await pausa(2500);
      const todas = comprador.getByRole('button', { name: 'Marcar todas como lidas', exact: true }); if (await todas.isVisible()) await todas.click();
    }, 8000);
    await cena('Demonstração concluída · Quatro papéis, leilão, Laravel e funcionalidades adicionais', [comprador], async () => {}, 3000);
    const duracao = (Date.now()-inicio)/1000; capturar = false; await capturando; await contextoVideo.close();
    const ficheiro = path.join(destino, 'demonstracao-do-campo-a-mesa.webm'); await video.saveAs(ficheiro);
    await fs.writeFile(path.join(destino, 'resultado.json'), JSON.stringify({ sucesso: true, duracaoSegundos: duracao, limiteSegundos: 300, etapas, criados, ficheiro, gravacao: 'Capturas contínuas das páginas reais, compostas numa vista única com legendas. Leilão com duas sessões lado a lado. Sem áudio.' }, null, 2));
    console.log(`SUCESSO: ${duracao.toFixed(1)} segundos. Vídeo: ${ficheiro}`);
  } finally { capturar = false; await capturando; parar?.(); await validacao?.(); await browser?.close(); await vite?.close(); if (io) await new Promise(r => io.close(r)); php?.kill(); await mongoose.disconnect(); await fs.writeFile(path.join(destino, 'registos-criados.json'), JSON.stringify(criados, null, 2)); }
}
main().catch(async err => { console.error(err.name, err.message.includes('mongodb') ? 'Falha de ligação ao MongoDB.' : err.message); process.exitCode = 1; });

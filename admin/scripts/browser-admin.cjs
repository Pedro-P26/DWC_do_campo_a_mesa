const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const apiRequire = createRequire(path.resolve(__dirname, '../../api/package.json'));
const { MongoMemoryReplSet } = apiRequire('mongodb-memory-server');
const { io: connectSocket } = createRequire(path.resolve(__dirname, '../../web/package.json'))('socket.io-client');
const jwt = apiRequire('jsonwebtoken');
const mongoose = apiRequire('mongoose');
const bcrypt = apiRequire('bcryptjs');
const { chromium, expect } = apiRequire('@playwright/test');
const { Server } = apiRequire('socket.io');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    const downloadDir = path.resolve(__dirname, '../../api/node_modules/.cache/mongodb-memory-server');
    const binaryName = fs.existsSync(downloadDir) ? fs.readdirSync(downloadDir).find(name => /^mongod-.*\.exe$/.test(name)) : undefined;
    const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { downloadDir, ...(binaryName ? { systemBinary: path.join(downloadDir, binaryName) } : {}) } });
    let php, browser, io, pararValidacao, produtorSocket;
    try {
        const database = `dcm_admin_test_${randomBytes(8).toString('hex')}`;
        await mongoose.connect(mongo.getUri(), { dbName: database });
        const User = apiRequire('./src/models/User');
        const Order = apiRequire('./src/models/Order');
        const Auction = apiRequire('./src/models/Auction');
        const Review = apiRequire('./src/models/Review');
        const passwordHash = await bcrypt.hash('password123', 4);
        const [admin, produtor, comprador, rejeitar] = await User.create([
            { nome: 'Sofia Carvalho', email: 'admin@teste.pt', passwordHash, papel: 'admin' },
            { nome: 'Casa do Vale', email: 'produtor@teste.pt', passwordHash, papel: 'produtor', produtor: { nomeExploracao: 'Casa do Vale Verde', localidade: 'Caminha', descricao: 'Hortícolas da região.' } },
            { nome: 'Comprador', email: 'comprador@teste.pt', passwordHash, papel: 'comprador' },
            { nome: 'Por rejeitar', email: 'rejeitar@teste.pt', passwordHash, papel: 'produtor' }
        ]);
        const order = await Order.create({ comprador: comprador._id, produtor: produtor._id, linhas: [{ nome: 'Kiwi Hayward', precoUnit: 2.4, quantidade: 3 }], estado: 'entregue' });
        const review = await Review.create({ autor: comprador._id, produtor: produtor._id, encomenda: order._id, comentario: 'Avaliação denunciada para moderação', classificacao: 3, denuncias: 2 });
        const auction = await Auction.create({ produtor: produtor._id, lote: '200 kg de kiwi Hayward', precoBase: 10, incremento: 1, licitacaoAtual: { valor: 12 }, iniciaEm: new Date(), terminaEm: new Date(Date.now() + 600000), estado: 'ativo', numLicitacoes: 1 });
        process.env.JWT_SECRET = 'segredo-exclusivo-do-teste-browser';
        const app = apiRequire('./src/app');
        const apiServer = http.createServer(app);
        io = new Server(apiServer);
        app.set('io', io);
        apiRequire('./src/sockets')(io);
        pararValidacao = await apiRequire('./src/services/validacaoProdutores')(io);
        apiServer.listen(0, '127.0.0.1'); await once(apiServer, 'listening');
        produtorSocket = connectSocket(`http://127.0.0.1:${apiServer.address().port}`, { auth: {
            token: jwt.sign({ id: produtor.id, nome: produtor.nome, papel: 'produtor' }, process.env.JWT_SECRET)
        } });
        await once(produtorSocket, 'connect', { signal: AbortSignal.timeout(10000) });
        const reserva = net.createServer().listen(0, '127.0.0.1'); await once(reserva, 'listening');
        const port = reserva.address().port; await new Promise(resolve => reserva.close(resolve));
        const base = `http://127.0.0.1:${port}`;
        php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', 'public'], {
            cwd: path.resolve(__dirname, '..'), stdio: ['ignore', 'ignore', 'ignore'],
            env: { ...process.env, APP_ENV: 'local', APP_DEBUG: 'false', APP_KEY: `base64:${randomBytes(32).toString('base64')}`,
                APP_URL: base, DB_CONNECTION: 'mongodb', MONGODB_URI: mongo.getUri(), MONGODB_DATABASE: database,
                API_URL: `http://127.0.0.1:${apiServer.address().port}`, STORAGE_HEALTH_URL: '', SESSION_DRIVER: 'file' }
        });
        php.on('error', error => console.error(error.message));
        let pronto = false;
        for (let i = 0; i < 100; i++) {
            if (await fetch(`${base}/up`).then(r => r.ok).catch(() => false)) { pronto = true; break; }
            await delay(100);
        }
        if (!pronto) throw new Error('O servidor PHP de teste não arrancou.');
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        const page = await context.newPage();
        const erros = [];
        page.on('pageerror', erro => erros.push(erro.message));
        await page.goto(base);
        await expect(page.getByRole('heading', { name: 'Entrar na administração' })).toBeVisible();
        await page.getByLabel('Email', { exact: true }).fill('admin@teste.pt');
        await page.getByLabel('Password', { exact: true }).fill('password123');
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
        await expect(page.locator('[data-indicador="utilizadores"]')).toHaveText('4');
        await expect(page.locator('[data-servico="api"]')).toHaveText('Operacional', { timeout: 15000 });
        await expect(page.locator('[data-servico="sockets"]')).toHaveText('Operacional');
        const resultDir = path.resolve(__dirname, '../test-results'); fs.mkdirSync(resultDir, { recursive: true });
        await page.screenshot({ path: path.join(resultDir, 'admin-desktop.png'), fullPage: true });
        await Auction.updateOne({ _id: auction._id }, { $set: { 'licitacaoAtual.valor': 17, numLicitacoes: 2 } });
        await expect(page.locator('[data-leiloes]')).toContainText('17,00', { timeout: 12000 });
        const notificacao = once(produtorSocket, 'conta-validada', { signal: AbortSignal.timeout(10000) });
        await page.getByRole('button', { name: 'Aprovar produtor Casa do Vale', exact: true }).click();
        expect((await notificacao)[0]).toEqual({ id: produtor.id });
        await expect(page.getByRole('status').filter({ hasText: 'Produtor aprovado.' })).toBeVisible();
        expect((await User.findById(produtor._id)).produtor.validado).toBe(true);
        const artigo = page.locator(`[data-avaliacao="${review.id}"]`);
        await artigo.getByRole('button', { name: 'Ocultar', exact: true }).click();
        expect((await Review.findById(review._id)).visivel).toBe(false);
        await page.locator(`[data-avaliacao="${review.id}"]`).getByRole('button', { name: 'Repor', exact: true }).click();
        await page.locator(`[data-avaliacao="${review.id}"]`).getByRole('button', { name: 'Manter e resolver denúncias' }).click();
        expect((await Review.findById(review._id)).denuncias).toBe(0);
        const csrf = await context.request.patch(`${base}/moderacao/${review.id}`, { form: { decisao: 'ocultar' } });
        expect(csrf.status()).toBe(419);
        await page.getByRole('link', { name: 'Produtores', exact: true }).click();
        await page.getByRole('button', { name: 'Rejeitar produtor Por rejeitar', exact: true }).click();
        expect((await User.findById(rejeitar._id)).produtor.rejeitado).toBe(true);
        for (const nome of ['Utilizadores', 'Encomendas', 'Leilões', 'Serviços']) {
            await page.getByRole('link', { name: nome, exact: true }).click();
            await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({ path: path.join(resultDir, 'admin-mobile.png'), fullPage: true });
        await page.getByRole('button', { name: 'Sair', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Entrar na administração' })).toBeVisible();
        await page.getByLabel('Email', { exact: true }).fill('comprador@teste.pt');
        await page.getByLabel('Password', { exact: true }).fill('password123');
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('conta sem acesso');
        expect(erros).toEqual([]);
        console.log('Browser: login, MongoDB/Mongoose, aprovação com notificação Socket.io, rejeição, moderação, CSRF, atualização automática, navegação, mobile e logout passaram.');
    } finally {
        produtorSocket?.disconnect();
        await pararValidacao?.();
        await browser?.close();
        if (php && php.exitCode === null) { const terminou = once(php, 'exit'); php.kill(); await terminou.catch(() => {}); }
        if (io) await new Promise(resolve => io.close(resolve));
        await mongoose.disconnect();
        await mongo.stop();
    }
})().catch(erro => { console.error(erro); process.exitCode = 1; });

const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const apiRequire = createRequire(path.resolve(__dirname, '../../package.json'));
const { MongoMemoryReplSet } = apiRequire('mongodb-memory-server');
const { io: connectSocket } = createRequire(path.resolve(__dirname, '../../../web/package.json'))('socket.io-client');
const jwt = apiRequire('jsonwebtoken');
const mongoose = apiRequire('mongoose');
const bcrypt = apiRequire('bcryptjs');
const { chromium, expect } = apiRequire('@playwright/test');
const { Server } = apiRequire('socket.io');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const visivel = process.argv.includes('--visible');

(async () => {
    const downloadDir = path.resolve(__dirname, '../../node_modules/.cache/mongodb-memory-server');
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
            cwd: path.resolve(__dirname, '../../../admin'), stdio: ['ignore', 'ignore', 'ignore'],
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
        console.log(`Backoffice de teste: ${base}`);
        browser = await chromium.launch({ headless: !visivel, slowMo: visivel ? 350 : 0 });
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
        await expect(page.locator('[data-servico="mongodb"]')).toHaveText('Operacional');
        await expect(page.locator('[data-servico="swagger"]')).toHaveText('Operacional');
        const resultDir = path.resolve(__dirname, '../../../admin/test-results'); fs.mkdirSync(resultDir, { recursive: true });
        await page.screenshot({ path: path.join(resultDir, 'admin-desktop.png'), fullPage: true });
        await Auction.updateOne({ _id: auction._id }, { $set: { 'licitacaoAtual.valor': 17, numLicitacoes: 2 } });
        await expect(page.locator('[data-leiloes]')).toContainText('17,00', { timeout: 12000 });
        await expect(page.locator('[data-leiloes] .contagem')).toHaveText(/^0?\d:\d{2}$/);
        const notificacao = once(produtorSocket, 'conta-validada', { signal: AbortSignal.timeout(10000) });
        await page.getByRole('button', { name: 'Aprovar produtor Casa do Vale', exact: true }).click();
        expect((await notificacao)[0]).toEqual({ id: produtor.id });
        await expect(page.getByRole('status').filter({ hasText: 'Produtor aprovado.' })).toBeVisible();
        expect((await User.findById(produtor._id)).produtor.validado).toBe(true);
        const artigo = page.locator(`[data-avaliacao="${review.id}"]`);
        await artigo.getByRole('button', { name: 'Ocultar', exact: true }).click();
        expect((await Review.findById(review._id)).visivel).toBe(false);
        await page.getByRole('link', { name: 'Moderação', exact: true }).click();
        await page.getByLabel('Avaliações', { exact: true }).selectOption('ocultas');
        await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
        await expect(page.locator(`[data-avaliacao="${review.id}"]`)).toBeVisible();
        await page.locator(`[data-avaliacao="${review.id}"]`).getByRole('button', { name: 'Repor', exact: true }).click();
        expect((await Review.findById(review._id)).visivel).toBe(true);
        await page.getByLabel('Avaliações', { exact: true }).selectOption('denunciadas');
        await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
        await page.locator(`[data-avaliacao="${review.id}"]`).getByRole('button', { name: 'Manter e resolver denúncias' }).click();
        expect((await Review.findById(review._id)).denuncias).toBe(0);
        const csrf = await context.request.patch(`${base}/moderacao/${review.id}`, { form: { decisao: 'ocultar' } });
        expect(csrf.status()).toBe(419);
        await page.getByRole('link', { name: 'Produtores', exact: true }).click();
        await page.getByRole('button', { name: 'Rejeitar produtor Por rejeitar', exact: true }).click();
        expect((await User.findById(rejeitar._id)).produtor.rejeitado).toBe(true);
        console.log('OK Login, serviços, leilões em direto, aprovação, rejeição e moderação.');
        for (const [estado, conta] of [['aprovados', produtor], ['rejeitados', rejeitar]]) {
            await page.getByLabel('Estado', { exact: true }).selectOption(estado);
            await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
            await expect(page.locator(`[data-produtor="${conta.id}"]`)).toBeVisible();
        }
        await page.getByRole('link', { name: 'Utilizadores', exact: true }).click();
        await page.getByLabel('Nome ou email').fill('admin@teste.pt');
        await page.getByLabel('Papel', { exact: true }).selectOption('admin');
        await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
        await expect(page.locator('tbody tr')).toHaveCount(1);
        await expect(page.locator('tbody')).toContainText(admin.email);
        await page.getByRole('link', { name: 'Encomendas', exact: true }).click();
        await page.getByLabel('Estado', { exact: true }).selectOption('entregue');
        await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
        await expect(page.locator('tbody tr')).toHaveCount(1);
        await page.getByText('Ver produtos', { exact: true }).click();
        await expect(page.locator('details')).toContainText('Kiwi Hayward');
        await expect(page.locator('tbody')).toContainText('7,20');
        await page.getByRole('link', { name: 'Leilões', exact: true }).click();
        await page.getByLabel('Estado', { exact: true }).selectOption('ativo');
        await page.getByRole('button', { name: 'Filtrar histórico', exact: true }).click();
        await expect(page.locator('tbody')).toContainText(auction.lote);
        await page.getByRole('button', { name: 'Atualizar agora', exact: true }).click();
        await expect(page.locator('[data-atualizacao]')).toContainText('Atualizado às');

        // Volume suficiente para percorrer duas páginas em cada lista de gestão.
        await User.create(Array.from({ length: 21 }, (_, i) => ({
            nome: `Exploração ${i + 1}`, email: `exploracao${i + 1}@teste.pt`, passwordHash, papel: 'produtor',
            produtor: { nomeExploracao: `Exploração ${i + 1}`, localidade: 'Caminha' }
        })));
        const pedidos = await Order.create(Array.from({ length: 21 }, () => ({
            comprador: comprador.id, produtor: produtor.id, estado: 'entregue',
            linhas: [{ nome: 'Kiwi Hayward', precoUnit: 2.4, quantidade: 1 }]
        })));
        await Review.create(pedidos.map(pedido => ({
            autor: comprador.id, produtor: produtor.id, encomenda: pedido.id,
            comentario: 'Avaliação por analisar', classificacao: 3, denuncias: 1
        })));
        await Auction.create(Array.from({ length: 21 }, (_, i) => ({
            produtor: produtor.id, lote: `Lote ${i + 1}`, precoBase: 10, incremento: 1,
            iniciaEm: new Date(Date.now() + 3600000), terminaEm: new Date(Date.now() + 7200000), estado: 'agendado'
        })));
        for (const nome of ['Produtores', 'Moderação', 'Utilizadores', 'Encomendas', 'Leilões']) {
            await page.getByRole('link', { name: nome, exact: true }).click();
            const paginacao = page.getByRole('navigation', { name: 'Paginação', exact: true });
            await expect(paginacao).toContainText('Página 1 de 2');
            await paginacao.getByRole('link', { name: 'Seguinte', exact: true }).click();
            await expect(paginacao).toContainText('Página 2 de 2');
            await paginacao.getByRole('link', { name: 'Anterior', exact: true }).click();
            await expect(paginacao).toContainText('Página 1 de 2');
            console.log(`OK Paginação: ${nome}.`);
            if (visivel) await delay(1000);
        }
        await page.getByRole('link', { name: 'Serviços', exact: true }).click();
        await expect(page.locator('[data-servico="api"]')).toHaveText('Operacional');
        await expect(page.locator('[data-servico="storage"]')).toHaveText('Não configurado');
        for (const largura of [390, 320]) {
            await page.setViewportSize({ width: largura, height: 844 });
            for (const nome of ['Visão geral', 'Produtores', 'Moderação', 'Utilizadores', 'Encomendas', 'Leilões', 'Serviços']) {
                await page.getByRole('link', { name: nome, exact: true }).click();
                const titulo = nome === 'Serviços' ? 'Estado dos serviços' : nome;
                await expect(page.getByRole('heading', { level: 1, name: titulo, exact: true })).toBeVisible();
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
                if (visivel) await delay(700);
            }
            await page.getByRole('link', { name: 'Visão geral', exact: true }).click();
            await page.screenshot({ path: path.join(resultDir, `admin-mobile-${largura}.png`), fullPage: true });
            console.log(`OK Todas as páginas a ${largura} px.`);
        }
        await page.screenshot({ path: path.join(resultDir, 'admin-mobile.png'), fullPage: true });
        await page.getByRole('button', { name: 'Sair', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Entrar na administração' })).toBeVisible();
        await page.getByLabel('Email', { exact: true }).fill('comprador@teste.pt');
        await page.getByLabel('Password', { exact: true }).fill('password123');
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('conta sem acesso');
        await page.getByLabel('Email', { exact: true }).fill('produtor@teste.pt');
        await page.getByLabel('Password', { exact: true }).fill('password123');
        await page.getByRole('button', { name: 'Entrar', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('conta sem acesso');
        expect(erros).toEqual([]);
        console.log('Browser: login, permissões, aprovação com Socket.io, rejeição, moderação, CSRF, atualização automática, filtros, paginação das cinco listas, navegação, mobile a 320/390 px e logout passaram.');
        if (visivel) {
            await page.setViewportSize({ width: 1440, height: 1000 });
            await page.getByLabel('Email', { exact: true }).fill('admin@teste.pt');
            await page.getByLabel('Password', { exact: true }).fill('password123');
            await page.getByRole('button', { name: 'Entrar', exact: true }).click();
            await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
            await delay(10000);
        }
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

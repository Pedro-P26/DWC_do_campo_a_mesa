// Acrescenta uma demonstração mobile real ao vídeo validado, sem escrever na BD.
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { once } = require('node:events');
const { spawnSync } = require('node:child_process');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { chromium, expect } = require('@playwright/test');
const User = require('../../src/models/User');
const raiz = path.resolve(__dirname, '../../..');
const destino = path.join(raiz, 'api/test-results/demonstracao-mobile-revista');
const anterior = path.join(raiz, 'api/test-results/demonstracao-video-v2');
const ffmpeg = path.join(raiz, 'api/test-results/demonstracao-final/ferramentas/package/ffmpeg.exe');
const pausa = ms => new Promise(r => setTimeout(r, ms));
require('dotenv').config({ path: path.join(raiz, 'api/.env'), quiet: true });
let io, vite, browser, browserGravacao, cVideo, gravando = false, captura;
async function main() {
  await fs.mkdir(destino, { recursive: true });
  try {
    const r = JSON.parse(await fs.readFile(path.join(anterior, 'resultado.json'), 'utf8'));
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
    const conta = await User.findById(r.criados.find(c => c.tipo === 'utilizador').id);
    if (!conta || conta.papel !== 'comprador') throw new Error('Conta da demonstração anterior indisponível.');
    const token = jwt.sign({ id: conta.id, nome: conta.nome, papel: conta.papel }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const app = require('../../src/app'); const http = app.listen(0, '127.0.0.1'); await once(http, 'listening');
    const apiUrl = `http://127.0.0.1:${http.address().port}`;
    io = new Server(http, { cors: { origin: (o, cb) => cb(null, !o || o === process.env.CLIENT_URL) } });
    app.set('io', io); require('../../src/sockets')(io);
    const { createServer } = await import(pathToFileURL(path.join(raiz, 'web/node_modules/vite/dist/node/index.js')).href);
    vite = await createServer({ root: path.join(raiz, 'web'), server: { host: '127.0.0.1', port: 0 }, define: { 'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl), 'import.meta.env.VITE_USAR_DADOS_SIMULADOS': '"false"' } });
    await vite.listen(); const base = vite.resolvedUrls.local[0].replace(/\/$/, ''); process.env.CLIENT_URL = base;
    browser = await chromium.launch({ headless: false, args: ['--window-size=1440,1000'] });
    const contexto = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await contexto.addInitScript(sessao => localStorage.setItem('sessao', JSON.stringify(sessao)), { token, utilizador: conta.publico() });
    const mobile = await contexto.newPage(); mobile.setDefaultTimeout(10000);
    await mobile.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(mobile.locator('.cartao-produto').first()).toBeVisible({ timeout: 60000 });
    await mobile.evaluate(() => window.scrollTo(0, 0));
    const barra = mobile.getByRole('navigation', { name: 'Navegação móvel', exact: true }); await expect(barra).toBeVisible();
    const colunas = await mobile.locator('.grelha-produtos').evaluate(e => getComputedStyle(e).gridTemplateColumns.split(' ').length);
    if (colunas !== 2) throw new Error('O catálogo mobile não mostra duas colunas.');
    const posicoesBarra = [];
    async function verificarBarra(etapa) {
      const posicao = await barra.evaluate(e => ({
        fundo: e.getBoundingClientRect().bottom,
        alturaEcra: innerHeight,
        deslocamento: scrollY,
        posicionamento: getComputedStyle(e).position
      }));
      if (posicao.posicionamento !== 'fixed' || Math.abs(posicao.fundo - posicao.alturaEcra) > 1) {
        throw new Error(`A barra inferior não está fixa no fundo do ecrã em ${etapa}.`);
      }
      posicoesBarra.push({ etapa, ...posicao });
    }
    await verificarBarra('catálogo no início');
    browserGravacao = await chromium.launch({ headless: true });
    cVideo = await browserGravacao.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, recordVideo: { dir: destino, size: { width: 1920, height: 1080 } } });
    const gravador = await cVideo.newPage(); const video = gravador.video();
    await gravador.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#f6f2ea;color:#22452b;font-family:Arial}header{height:100px;padding:18px 36px;background:#22452b;color:#fff}h1{font-size:28px;margin:0}header p{font-size:21px;margin:9px 0}main{height:930px;display:flex;align-items:center;justify-content:center;gap:95px}.telemovel{width:390px;height:844px;flex-shrink:0;outline:7px solid #22452b;border-radius:16px;overflow:hidden;background:white}img{display:block;height:844px;width:390px}aside{width:900px}h2{font-size:34px;margin:0 0 16px}b{display:inline-block;font-size:23px;padding:9px 18px;border-radius:8px;background:#22452b;color:white}small{display:block;font-size:21px;margin-top:17px}li{font-size:28px;line-height:1.5;margin:15px 0}footer{padding:0 36px;font-size:17px}</style><header><h1>Do Campo à Mesa</h1><p>Vista mobile · Mobile First · 390 × 844 px</p></header><main><div class="telemovel"><img id="ecra"></div><aside><b>Comprador 1 · Vista mobile</b><h2 id="nome"></h2><small id="email"></small><ul id="passos"></ul></aside></main><footer>Mesma aplicação e mesma conta · Emulação mobile no Chromium com Playwright · Sem áudio</footer>`);
    await gravador.evaluate(u => { document.querySelector('#nome').textContent = u.nome; document.querySelector('#email').textContent = u.email; }, { nome: conta.nome, email: conta.email });
    let topicos = ['Catálogo com duas colunas', 'Barra inferior fixa no fundo do ecrã'];
    gravando = true;
    captura = (async () => { while (gravando) { try { const imagem = (await mobile.screenshot({ type: 'jpeg', quality: 90 })).toString('base64'); await gravador.evaluate(({ imagem, topicos }) => { document.querySelector('#ecra').src = 'data:image/jpeg;base64,' + imagem; const lista = document.querySelector('#passos'); lista.replaceChildren(); for (const t of topicos) { const li = document.createElement('li'); li.textContent = t; lista.append(li); } }, { imagem, topicos }); } catch {} await pausa(250); } })();
    const inicio = Date.now();
    await gravador.waitForFunction(() => document.querySelector('#ecra').naturalWidth > 0);
    console.log('MOBILE Catálogo e barra inferior fixa.');
    await pausa(2000);
    await mobile.evaluate(() => window.scrollBy({ top: 430, behavior: 'smooth' }));
    await pausa(1000);
    await verificarBarra('catálogo após deslocação');
    topicos = ['A página desloca-se', 'A barra permanece no fundo do ecrã'];
    await pausa(2000);
    await gravador.screenshot({ path: path.join(destino, 'catalogo-mobile.png') });
    await mobile.getByLabel('Pesquisar produtos', { exact: true }).scrollIntoViewIfNeeded();
    await mobile.getByRole('button', { name: /Mais filtros/ }).click();
    topicos = ['Filtros que abrem no telemóvel', 'Campos adaptados à largura disponível'];
    await mobile.getByLabel('Preço máximo (€)', { exact: true }).fill('3');
    await mobile.getByLabel('Preço máximo (€)', { exact: true }).blur();
    await verificarBarra('filtros');
    await pausa(4500);
    await gravador.screenshot({ path: path.join(destino, 'filtros-mobile.png') });
    console.log('MOBILE Filtros adaptados ao telemóvel.');
    await barra.getByRole('link', { name: 'Encomendas', exact: true }).click();
    const id = r.criados.find(c => c.tipo === 'compra').id;
    const estado = mobile.getByTestId(`encomenda-${id}`).getByLabel('Estado: entregue', { exact: true });
    await expect(estado).toBeVisible(); await estado.scrollIntoViewIfNeeded();
    const vertical = await estado.locator('li').evaluateAll(es => es[1].getBoundingClientRect().top > es[0].getBoundingClientRect().top);
    if (!vertical) throw new Error('A linha de estados mobile não está vertical.');
    await verificarBarra('encomendas');
    topicos = ['Estados da encomenda na vertical', 'Barra inferior fixa no fundo do ecrã'];
    await pausa(8500); console.log('MOBILE Estados da encomenda na vertical.');
    await gravador.screenshot({ path: path.join(destino, 'vista-mobile.png') });
    gravando = false; await captura; const duracaoMobile = (Date.now()-inicio)/1000;
    await cVideo.close(); await video.saveAs(path.join(destino, 'mobile.webm'));
    const final = path.join(destino, 'demonstracao-do-campo-a-mesa.mp4');
    const juntar = spawnSync(ffmpeg, [
      '-hide_banner', '-loglevel', 'error',
      '-i', path.join(anterior, 'demonstracao-do-campo-a-mesa.webm'),
      '-i', path.join(destino, 'mobile.webm'),
      '-filter_complex', '[0:v]setpts=PTS-STARTPTS[principal];[1:v]trim=start=2:duration=17.88,setpts=PTS-STARTPTS[mobile];[principal][mobile]concat=n=2:v=1:a=0[video]',
      '-map', '[video]', '-an', '-r', '25', '-c:v', 'libx264',
      '-preset', 'veryfast', '-threads', '4', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', final
    ], { encoding: 'utf8', windowsHide: true });
    if (juntar.status !== 0) throw new Error(juntar.stderr || 'Falha ao compor o vídeo.');
    const verificar = spawnSync(ffmpeg, ['-hide_banner', '-i', final], { encoding: 'utf8', windowsHide: true });
    const m = verificar.stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (!m) throw new Error('Não foi possível confirmar a duração.');
    const duracao = Number(m[1])*3600 + Number(m[2])*60 + Number(m[3]);
    if (duracao > 300) throw new Error(`Vídeo final excede 5 minutos: ${duracao}s.`);
    await fs.writeFile(path.join(destino, 'resultado.json'), JSON.stringify({ sucesso: true, duracaoSegundos: duracao, mobileSegundos: duracaoMobile, larguraMobile: 390, alturaMobile: 844, colunas, estadosVerticais: vertical, posicoesBarra, conta: { nome: conta.nome, email: conta.email, papel: conta.papel }, ficheiro: final, semEscritasNaBase: true, origem: r.ficheiro }, null, 2));
    console.log(`SUCESSO Vídeo final: ${duracao.toFixed(2)} segundos. ${final}`);
  } finally { gravando = false; await captura; await browserGravacao?.close(); await browser?.close(); await vite?.close(); if (io) await new Promise(r => io.close(r)); await mongoose.disconnect(); }
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });

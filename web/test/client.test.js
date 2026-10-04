import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transform } from 'esbuild';

const fonte = await readFile(new URL('../src/api/client.js', import.meta.url), 'utf8');
const { code } = await transform(fonte, {
  format: 'esm', define: { 'import.meta.env': JSON.stringify({ VITE_API_URL: 'http://api-teste' }) }
});
const { api, enviarFicheiro, ErroApi } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('Cliente HTTP: JSON, erros e upload multipart', async (t) => {
  const fetchOriginal = globalThis.fetch;
  let resposta;
  let pedido;
  globalThis.fetch = async (url, opcoes) => { pedido = { url, ...opcoes }; return resposta; };
  try {
    await t.test('Envia JSON e token, e recebe dados', async () => {
      resposta = new Response(JSON.stringify({ id: 1 }), { status: 200 });
      assert.deepEqual(await api('/teste', { metodo: 'POST', corpo: { nome: 'Kiwi' }, token: 'abc' }), { id: 1 });
      assert.equal(pedido.url, 'http://api-teste/api/teste');
      assert.equal(pedido.headers.Authorization, 'Bearer abc');
      assert.equal(pedido.headers['Content-Type'], 'application/json');
      assert.deepEqual(JSON.parse(pedido.body), { nome: 'Kiwi' });
    });
    await t.test('204 devolve null e GET sem corpo não envia Content-Type', async () => {
      resposta = new Response(null, { status: 204 });
      assert.equal(await api('/teste'), null);
      assert.equal(pedido.headers['Content-Type'], undefined);
    });
    await t.test('ErroApi inclui a mensagem e o código HTTP', async () => {
      resposta = new Response(JSON.stringify({ erro: 'Sem permissão' }), { status: 403 });
      await assert.rejects(api('/teste'), erro => erro instanceof ErroApi && erro.codigo === 403 && erro.message === 'Sem permissão');
      resposta = new Response('indisponível', { status: 502 });
      await assert.rejects(api('/teste'), erro => erro.codigo === 502 && erro.message === 'Erro 502');
    });
    await t.test('Upload usa FormData e deixa o browser definir Content-Type', async () => {
      resposta = new Response(JSON.stringify({ imagemUrl: '/imagem.jpg' }), { status: 200 });
      await enviarFicheiro('/products/1/imagem', 'imagem', new Blob(['imagem'], { type: 'image/jpeg' }), 'abc');
      assert.equal(pedido.method, 'POST');
      assert.ok(pedido.body instanceof FormData);
      assert.equal(pedido.body.get('imagem').size, 6);
      assert.equal(pedido.headers.Authorization, 'Bearer abc');
      assert.equal(pedido.headers['Content-Type'], undefined);
    });
  } finally { globalThis.fetch = fetchOriginal; }
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const auth = require('../src/middleware/auth');
const router = require('../src/routes/auth');

test('Login: credenciais, JWT e controlo de acesso', async (t) => {
  const secretAnterior = process.env.JWT_SECRET;
  const duracaoAnterior = process.env.JWT_EXPIRES_IN;
  const findOneAnterior = User.findOne;
  process.env.JWT_SECRET = 'segredo-apenas-para-o-teste-local';
  process.env.JWT_EXPIRES_IN = '2h';

  const conta = new User({
    _id: '507f1f77bcf86cd799439011', nome: 'Produtor de teste',
    email: 'produtor@exemplo.pt', papel: 'produtor',
    passwordHash: await bcrypt.hash('password-de-teste', 4)
  });
  User.findOne = (filtro) => ({
    select: async (campos) => {
      assert.equal(campos, '+passwordHash');
      return filtro.email === conta.email ? conta : null;
    }
  });

  const app = express();
  app.use(express.json());
  app.use('/api/auth', router);
  app.get('/produtor', auth('produtor'), (req, res) => res.json({ id: req.user.id }));
  app.get('/admin', auth('admin'), (req, res) => res.json({ id: req.user.id }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = (corpo) => fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
  });

  try {
    await t.test('Rejeita campos vazios ou tipos inválidos', async () => {
      for (const corpo of [{}, { email: {}, password: 'abc' }, { email: ' ', password: 'abc' },
        { email: conta.email, password: [] }]) {
        assert.equal((await login(corpo)).status, 400);
      }
    });

    await t.test('Não distingue email inexistente de password errada', async () => {
      const desconhecido = await login({ email: 'outro@exemplo.pt', password: 'password-de-teste' });
      const errado = await login({ email: conta.email, password: 'errada' });
      assert.equal(desconhecido.status, 401);
      assert.equal(errado.status, 401);
      assert.deepEqual(await desconhecido.json(), await errado.json());
    });

    await t.test('Normaliza email, não expõe hash e emite JWT com expiração', async () => {
      const resposta = await login({ email: ' PRODUTOR@EXEMPLO.PT ', password: 'password-de-teste' });
      assert.equal(resposta.status, 200);
      const dados = await resposta.json();
      assert.equal(dados.utilizador._id, conta._id.toString());
      assert.equal(dados.utilizador.papel, 'produtor');
      assert.ok(!('passwordHash' in dados.utilizador));
      const payload = jwt.verify(dados.token, process.env.JWT_SECRET);
      assert.equal(payload.id, conta._id.toString());
      assert.equal(payload.papel, 'produtor');
      assert.equal(payload.nome, conta.nome);
      assert.equal(payload.exp - payload.iat, 7200);
      const headers = { Authorization: `Bearer ${dados.token}` };
      assert.equal((await fetch(`${base}/produtor`, { headers })).status, 200);
      assert.equal((await fetch(`${base}/admin`, { headers })).status, 403);
      assert.equal((await fetch(`${base}/produtor`)).status, 401);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    User.findOne = findOneAnterior;
    if (secretAnterior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secretAnterior;
    if (duracaoAnterior === undefined) delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = duracaoAnterior;
  }
});

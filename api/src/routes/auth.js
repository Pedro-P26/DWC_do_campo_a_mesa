// Passo 6: registo e login
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const a = require('../utils/async');
const erro = require('../utils/erro');
const { objeto, escolher } = require('../utils/validar');

router.post('/registo', a(async (req, res) => {
  const corpo = objeto(req.body);
  const papel = corpo.papel ?? 'comprador';
  if (typeof corpo.nome !== 'string' || !corpo.nome.trim() || typeof corpo.email !== 'string' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(corpo.email.trim()) || typeof corpo.password !== 'string' ||
    corpo.password.length < 8 || corpo.password.length > 72 || !['comprador', 'produtor'].includes(papel)) throw erro(400, 'Dados de registo inválidos');
  const produtor = papel === 'produtor' ? { ...escolher(objeto(corpo.produtor ?? {}),
    ['nomeExploracao', 'descricao', 'localidade', 'localizacao']), validado: false } : undefined;
  const utilizador = await User.create({ nome: corpo.nome, email: corpo.email.trim().toLowerCase(), papel, produtor,
    passwordHash: await bcrypt.hash(corpo.password, 12) });
  res.status(201).json({ id: utilizador._id, token: emitirToken(utilizador), utilizador: utilizador.publico() });
}));

// POST /api/auth/login  -> 200 { token, utilizador }
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ erro: 'Indique o email e a password' });
    }

    const utilizador = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    if (!utilizador || !(await bcrypt.compare(password, utilizador.passwordHash))) {
      return res.status(401).json({ erro: 'Email ou password incorretos' });
    }

    const token = emitirToken(utilizador);
    res.json({
      token,
      utilizador: utilizador.publico()
    });
  } catch (err) { next(err); }
});

// GET /api/auth/eu  -> 200 dados do utilizador autenticado
router.get('/eu', auth(), a(async (req, res) => {
  const utilizador = await User.findById(req.user.id).select('nome email papel produtor');
  if (!utilizador) throw erro(404, 'Utilizador não encontrado');
  res.json(utilizador.publico());
}));

module.exports = router;

function emitirToken(u) {
  return jwt.sign({ id: u._id.toString(), papel: u.papel, nome: u.nome },
    process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '2h' });
}

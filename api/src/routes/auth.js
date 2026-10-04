// Passo 6: registo e login
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const porFazer = require('./_naoImplementado');

// POST /api/auth/registo  -> 201 { id }
// TODO: validar dados, fazer hash da password com bcrypt (custo 12) e criar o utilizador.
//       Um produtor fica com produtor.validado = false até o administrador aprovar.
router.post('/registo', porFazer('Registar utilizador (comprador ou produtor)'));

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

    const token = jwt.sign(
      { id: utilizador._id.toString(), papel: utilizador.papel },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
    );
    res.json({
      token,
      utilizador: {
        _id: utilizador._id,
        nome: utilizador.nome,
        email: utilizador.email,
        papel: utilizador.papel,
        produtor: utilizador.produtor
      }
    });
  } catch (err) { next(err); }
});

// GET /api/auth/eu  -> 200 dados do utilizador autenticado
router.get('/eu', auth(), porFazer('Devolver o utilizador autenticado'));

module.exports = router;

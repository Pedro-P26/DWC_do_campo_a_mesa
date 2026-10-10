// Painel do administrador
const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const Review = require('../models/Review');
const a = require('../utils/async');
const erro = require('../utils/erro');
const { id, objeto } = require('../utils/validar');

router.use(auth('admin'));

// GET /api/admin/estatisticas  -> 200 { utilizadores, produtores, encomendasHoje, leiloesAtivos }
router.get('/estatisticas', a(async (req, res) => {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const [utilizadores, produtores, encomendasHoje, leiloesAtivos] = await Promise.all([
    User.countDocuments(), User.countDocuments({ papel: 'produtor' }),
    Order.countDocuments({ createdAt: { $gte: hoje } }), Auction.countDocuments({ estado: 'ativo' })
  ]);
  res.json({ utilizadores, produtores, encomendasHoje, leiloesAtivos });
}));

// GET /api/admin/produtores/pendentes  -> 200 [produtores por validar]
router.get('/produtores/pendentes', a(async (req, res) => {
  res.json(await User.find({ papel: 'produtor', 'produtor.validado': false }).select('nome email produtor').sort({ createdAt: 1 }));
}));

// PATCH /api/admin/produtores/:id/validacao  { aprovado: true|false }  -> 200
router.patch('/produtores/:id/validacao', a(async (req, res) => {
  const { aprovado } = objeto(req.body);
  if (typeof aprovado !== 'boolean') throw erro(400, 'Indique aprovado como booleano');
  const produtor = await User.findOneAndUpdate({ _id: id(req.params.id), papel: 'produtor' },
    { $set: { 'produtor.validado': aprovado } }, { new: true, runValidators: true }).select('nome email produtor');
  if (!produtor) throw erro(404, 'Produtor não encontrado');
  if (aprovado) req.app.get('io')?.to(`user:${produtor._id}`).emit('conta-validada', { id: String(produtor._id) });
  res.json(produtor);
}));

// GET /api/admin/reviews/denunciadas  -> 200
router.get('/reviews/denunciadas', a(async (req, res) => {
  res.json(await Review.find({ denuncias: { $gt: 0 } }).sort({ createdAt: -1 }).populate('autor produtor', 'nome'));
}));

// PATCH /api/admin/reviews/:id  { visivel: false }  -> 200
router.patch('/reviews/:id', a(async (req, res) => {
  const { visivel } = objeto(req.body);
  if (typeof visivel !== 'boolean') throw erro(400, 'Indique visivel como booleano');
  const avaliacao = await Review.findByIdAndUpdate(id(req.params.id), { $set: { visivel } }, { new: true, runValidators: true });
  if (!avaliacao) throw erro(404, 'Avaliação não encontrada');
  res.json(avaliacao);
}));

module.exports = router;

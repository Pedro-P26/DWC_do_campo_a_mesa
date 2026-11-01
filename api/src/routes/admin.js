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
const periodosEstatisticas = require('../utils/periodosEstatisticas');
const paginar = require('../utils/paginar');

// $ne inclui contas antigas, anteriores à introdução do campo rejeitado.
const pendentes = { papel: 'produtor', 'produtor.validado': false, 'produtor.rejeitado': { $ne: true } };

router.use(auth('admin'));

// GET /api/admin/estatisticas: dia e últimos sete dias
router.get('/estatisticas', a(async (req, res) => {
  const { hoje, amanha, inicioSemana } = periodosEstatisticas();
  const [utilizadores, utilizadoresSemana, produtores, produtoresPendentes, encomendas, leiloesAtivos] = await Promise.all([
    User.countDocuments(), User.countDocuments({ createdAt: { $gte: inicioSemana, $lt: amanha } }),
    User.countDocuments({ papel: 'produtor', 'produtor.validado': true }), User.countDocuments(pendentes),
    Order.aggregate([
      { $match: { createdAt: { $gte: hoje, $lt: amanha } } },
      { $group: { _id: null, quantidade: { $sum: 1 }, total: { $sum: { $round: [{ $sum: {
        $map: { input: '$linhas', as: 'linha', in: { $multiply: ['$$linha.precoUnit', '$$linha.quantidade'] } }
      } }, 2] } } } }
    ]),
    Auction.countDocuments({ estado: 'ativo' })
  ]);
  res.json({ utilizadores, utilizadoresSemana, produtores, produtoresPendentes,
    encomendasHoje: encomendas[0]?.quantidade ?? 0,
    valorEncomendasHoje: Math.round((encomendas[0]?.total ?? 0) * 100) / 100, leiloesAtivos });
}));

// GET /api/admin/produtores/pendentes  -> 200 [produtores por validar]
router.get('/produtores/pendentes', a(async (req, res) => {
  res.json(await paginar(User.find(pendentes).select('nome email produtor createdAt').sort({ createdAt: 1, _id: 1 }), req.query));
}));

// PATCH /api/admin/produtores/:id/validacao  { aprovado: true|false }  -> 200
router.patch('/produtores/:id/validacao', a(async (req, res) => {
  const { aprovado } = objeto(req.body);
  if (typeof aprovado !== 'boolean') throw erro(400, 'Indique aprovado como booleano');
  const produtor = await User.findOneAndUpdate({ _id: id(req.params.id), papel: 'produtor' },
    { $set: { 'produtor.validado': aprovado, 'produtor.rejeitado': !aprovado } }, { new: true, runValidators: true }).select('nome email produtor');
  if (!produtor) throw erro(404, 'Produtor não encontrado');

  res.json(produtor);
}));

// GET /api/admin/reviews/denunciadas  -> 200
router.get('/reviews/denunciadas', a(async (req, res) => {
  res.json(await paginar(Review.find({ denuncias: { $gt: 0 } }).sort({ createdAt: -1, _id: -1 }).populate('autor produtor', 'nome'), req.query));
}));

// PATCH /api/admin/reviews/:id  { visivel: false, resolverDenuncias?: boolean }  -> 200
router.patch('/reviews/:id', a(async (req, res) => {
  const { visivel, resolverDenuncias } = objeto(req.body);
  if (typeof visivel !== 'boolean') throw erro(400, 'Indique visivel como booleano');
  if (resolverDenuncias !== undefined && typeof resolverDenuncias !== 'boolean') throw erro(400, 'Indique resolverDenuncias como booleano');
  const avaliacao = await Review.findByIdAndUpdate(id(req.params.id),
    { $set: { visivel, ...(resolverDenuncias ? { denuncias: 0, denunciantes: [] } : {}) } }, { new: true, runValidators: true });
  if (!avaliacao) throw erro(404, 'Avaliação não encontrada');
  res.json(avaliacao);
}));

module.exports = router;

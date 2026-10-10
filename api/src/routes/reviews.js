const router = require('express').Router();
const auth = require('../middleware/auth');
const Review = require('../models/Review');
const Order = require('../models/Order');
const a = require('../utils/async');
const erro = require('../utils/erro');
const { id, objeto } = require('../utils/validar');

// POST /api/reviews  (comprador, só após encomenda entregue)  -> 201
router.post('/', auth('comprador'), a(async (req, res) => {
  const corpo = objeto(req.body);
  const encomenda = await Order.findOne({ _id: id(corpo.encomenda), comprador: req.user.id, estado: 'entregue' });
  if (!encomenda) throw erro(404, 'Encomenda entregue não encontrada');
  const produto = corpo.produto === undefined ? undefined : id(corpo.produto);
  if (produto && !encomenda.linhas.some(l => l.produto?.toString() === produto)) throw erro(404, 'Produto não pertence à encomenda');
  if (!Number.isInteger(corpo.classificacao) || corpo.classificacao < 1 || corpo.classificacao > 5 ||
    (corpo.comentario !== undefined && typeof corpo.comentario !== 'string')) throw erro(400, 'Avaliação inválida');
  const avaliacao = await Review.create({ encomenda: encomenda._id, autor: req.user.id, produtor: encomenda.produtor,
    produto, classificacao: corpo.classificacao, comentario: corpo.comentario });
  res.status(201).json(avaliacao);
}));

// GET /api/reviews?produtor=&produto=  -> 200 [avaliações visíveis]
router.get('/', a(async (req, res) => {
  const filtro = { visivel: true };
  if (req.query.produtor) filtro.produtor = id(req.query.produtor);
  if (req.query.produto) filtro.produto = id(req.query.produto);
  res.json(await Review.find(filtro).sort({ createdAt: -1 }).populate('autor', 'nome'));
}));

// POST /api/reviews/:id/denuncia  -> 204
router.post('/:id/denuncia', auth(), a(async (req, res) => {
  const avaliacao = await Review.findOneAndUpdate({ _id: id(req.params.id), visivel: true }, { $inc: { denuncias: 1 } });
  if (!avaliacao) throw erro(404, 'Avaliação não encontrada');
  res.status(204).end();
}));

module.exports = router;

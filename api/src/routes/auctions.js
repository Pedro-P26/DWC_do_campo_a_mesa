// Leilões (a parte REST; as licitações em direto são feitas por Socket.io)
const router = require('express').Router();
const auth = require('../middleware/auth');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Product = require('../models/Product');
const produtorValidado = require('../middleware/produtorValidado');
const a = require('../utils/async');
const erro = require('../utils/erro');
const { id, objeto, escolher } = require('../utils/validar');

// GET /api/auctions?estado=ativo  -> 200 [leilões]
router.get('/', a(async (req, res) => {
  const filtro = {};
  if (req.query.estado !== undefined) {
    if (!['agendado', 'ativo', 'terminado'].includes(req.query.estado)) throw erro(400, 'Estado inválido');
    filtro.estado = req.query.estado;
  }
  res.json(await Auction.find(filtro).sort({ iniciaEm: -1 }).populate('produtor', 'nome produtor'));
}));

// GET /api/auctions/:id  -> 200 leilão + últimas licitações
router.get('/:id', a(async (req, res) => {
  const leilao = await Auction.findById(id(req.params.id)).populate('produtor', 'nome produtor');
  if (!leilao) throw erro(404, 'Leilão não encontrado');
  const licitacoes = await Bid.find({ leilao: leilao._id }).sort({ createdAt: -1, _id: -1 }).limit(20).populate('comprador', 'nome');
  res.json({ ...leilao.toObject(), licitacoes });
}));

// POST /api/auctions  (produtor)  -> 201
router.post('/', auth('produtor'), produtorValidado, a(async (req, res) => {
  const corpo = objeto(req.body);
  const iniciaEm = corpo.iniciaEm === undefined ? new Date() : new Date(typeof corpo.iniciaEm === 'string' ? corpo.iniciaEm : NaN);
  const duracao = corpo.duracaoMinutos ?? corpo.duracao;
  const terminaEm = corpo.terminaEm === undefined ? new Date(iniciaEm.getTime() + duracao * 60000)
    : new Date(typeof corpo.terminaEm === 'string' ? corpo.terminaEm : NaN);
  if (corpo.terminaEm === undefined && (typeof duracao !== 'number' || !Number.isFinite(duracao) || duracao <= 0)) throw erro(400, 'Duração inválida');
  if (!Number.isFinite(iniciaEm.getTime()) || !Number.isFinite(terminaEm.getTime()) || terminaEm <= iniciaEm || terminaEm <= new Date()) throw erro(400, 'Datas do leilão inválidas');
  if (corpo.produto !== undefined && !await Product.exists({ _id: id(corpo.produto), produtor: req.user.id })) throw erro(404, 'Produto não encontrado');
  const leilao = await Auction.create({ ...escolher(corpo, ['produto', 'lote', 'descricao', 'quantidade', 'precoBase', 'incremento']),
    produtor: req.user.id, iniciaEm, terminaEm, licitacaoAtual: { valor: corpo.precoBase },
    estado: iniciaEm <= new Date() ? 'ativo' : 'agendado' });
  res.status(201).location(`/api/auctions/${leilao._id}`).json(leilao);
}));

// GET /api/auctions/:id/bids  -> 200 [licitações]
router.get('/:id/bids', a(async (req, res) => {
  const leilao = id(req.params.id);
  if (!await Auction.exists({ _id: leilao })) throw erro(404, 'Leilão não encontrado');
  res.json(await Bid.find({ leilao }).sort({ createdAt: -1, _id: -1 }).populate('comprador', 'nome'));
}));

module.exports = router;

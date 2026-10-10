// Encomendas
const router = require('express').Router();
const auth = require('../middleware/auth');
const { Types } = require('mongoose');
const Product = require('../models/Product');
const Order = require('../models/Order');
const a = require('../utils/async');
const erro = require('../utils/erro');
const { id, objeto } = require('../utils/validar');
const acesso = (user) => user.papel === 'admin' ? {} : user.papel === 'produtor'
  ? { produtor: user.id } : { comprador: user.id };

// POST /api/orders  (comprador)  -> 201
router.post('/', auth('comprador'), a(async (req, res) => {
  const corpo = objeto(req.body);
  if (!Array.isArray(corpo.linhas) || !corpo.linhas.length || corpo.linhas.length > 100) throw erro(400, 'Indique entre 1 e 100 linhas');
  const entrega = corpo.entrega === undefined ? {} : objeto(corpo.entrega);
  const tipo = entrega.tipo ?? 'levantamento';
  if (!['levantamento', 'entrega'].includes(tipo) || (tipo === 'entrega' &&
    (typeof entrega.morada !== 'string' || !entrega.morada.trim()))) throw erro(400, 'Dados de entrega inválidos');
  if (entrega.morada !== undefined && typeof entrega.morada !== 'string') throw erro(400, 'Morada inválida');
  const quantidades = new Map();
  for (const linha of corpo.linhas) {
    objeto(linha);
    const produto = id(linha.produto);
    if (!Number.isSafeInteger(linha.quantidade) || linha.quantidade < 1) throw erro(400, 'Quantidade inválida');
    const total = (quantidades.get(produto) || 0) + linha.quantidade;
    if (!Number.isSafeInteger(total)) throw erro(400, 'Quantidade inválida');
    quantidades.set(produto, total);
  }
  const reservas = [];
  const encomendaIds = [];
  const criadas = [];
  try {
    const porProdutor = new Map();
    for (const [produto, quantidade] of quantidades) {
      const p = await Product.findOneAndUpdate({ _id: produto, stock: { $gte: quantidade } },
        { $inc: { stock: -quantidade } }, { new: true });
      if (!p) throw erro(409, 'Produto indisponível ou stock insuficiente');
      reservas.push({ produto: p._id, quantidade });
      const produtor = p.produtor.toString();
      if (!porProdutor.has(produtor)) porProdutor.set(produtor, []);
      porProdutor.get(produtor).push({ produto: p._id, nome: p.nome, precoUnit: p.preco,
        unidade: p.unidade, quantidade });
    }
    for (const [produtor, linhas] of porProdutor) {
      const _id = new Types.ObjectId();
      encomendaIds.push(_id);
      criadas.push(await Order.create({ _id, comprador: req.user.id, produtor, linhas,
        entrega: { tipo, morada: entrega.morada } }));
    }
  } catch (err) {
    // Repor todas as reservas e remover as encomendas deste pedido se alguma criação falhar.
    if (encomendaIds.length) await Order.deleteMany({ _id: { $in: encomendaIds } });
    await Promise.all(reservas.map(r => Product.updateOne({ _id: r.produto }, { $inc: { stock: r.quantidade } })));
    throw err;
  }
  for (const o of criadas) req.app.get('io')?.to(`user:${o.produtor}`).emit('nova-encomenda', { id: String(o._id), total: o.total });
  res.status(201).json(criadas);
}));

// GET /api/orders  -> 200 [encomendas do utilizador: como comprador ou como produtor]
router.get('/', auth(), a(async (req, res) => {
  res.json(await Order.find(acesso(req.user)).sort({ createdAt: -1 }).populate('comprador produtor', 'nome'));
}));

// GET /api/orders/:id  -> 200 | 404
router.get('/:id', auth(), a(async (req, res) => {
  const encomenda = await Order.findOne({ _id: id(req.params.id), ...acesso(req.user) }).populate('comprador produtor', 'nome');
  if (!encomenda) throw erro(404, 'Encomenda não encontrada');
  res.json(encomenda);
}));

// PATCH /api/orders/:id/estado  (produtor)  -> 200
router.patch('/:id/estado', auth('produtor'), a(async (req, res) => {
  const { estado } = objeto(req.body);
  const novo = Order.ESTADOS.indexOf(estado);
  if (novo < 0) throw erro(400, 'Estado inválido');
  const filtro = { _id: id(req.params.id), produtor: req.user.id };
  const encomenda = await Order.findOneAndUpdate({ ...filtro, estado: { $in: Order.ESTADOS.slice(0, novo) } },
    { $set: { estado } }, { new: true, runValidators: true });
  if (!encomenda) {
    const existe = await Order.exists(filtro);
    throw erro(existe ? 409 : 404, existe ? 'O estado só pode avançar' : 'Encomenda não encontrada');
  }
  req.app.get('io')?.to(`user:${encomenda.comprador}`).emit('encomenda-atualizada',
    { id: String(encomenda._id), estado: encomenda.estado, produtor: req.user.nome });
  res.json(encomenda);
}));

module.exports = router;

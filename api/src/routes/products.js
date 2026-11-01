// Passo 3: recurso /api/products
const router = require('express').Router();
const multer = require('multer');
const Product = require('../models/Product');
const User = require('../models/User');
const auth = require('../middleware/auth');
const produtorValidado = require('../middleware/produtorValidado');
const imagens = require('../services/imagens');
const avaliacoesProdutos = require('../services/avaliacoesProdutos');
const a = require('../utils/async');
const erro = require('../utils/erro');
const { id, objeto, texto, escaparRegex, escolher } = require('../utils/validar');
const CAMPOS = ['nome', 'descricao', 'ingredientes', 'categoria', 'preco', 'unidade', 'stock', 'biologico', 'epocas'];
const ORDENACAO = { recentes: { createdAt: -1, _id: -1 }, preco_asc: { preco: 1, _id: 1 }, preco_desc: { preco: -1, _id: 1 }, nome: { nome: 1, _id: 1 } };

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/products?q=&categoria=&precoMax=&bio=&epoca=  -> 200 [produtos]
router.get('/', async (req, res, next) => {
  try {
    const { q, categoria, precoMax, bio, epoca, produtor, localidade, ordenar } = req.query;
    const filtro = {};
    if (q) {
      const regex = { $regex: escaparRegex(texto(q).trim()), $options: 'i' };
      const produtores = await User.find({ papel: 'produtor', $or: [{ nome: regex }, { 'produtor.nomeExploracao': regex }] }).distinct('_id');
      filtro.$or = [{ nome: regex }, { ingredientes: regex }, { produtor: { $in: produtores } }];
    }
    if (localidade) {
      const produtores = await User.find({ papel: 'produtor', 'produtor.localidade': { $regex: escaparRegex(texto(localidade).trim()), $options: 'i' } }).distinct('_id');
      filtro.$and = [{ produtor: { $in: produtores } }];
    }
    if (categoria && categoria !== 'Todos') filtro.categoria = texto(categoria);
    if (epoca && epoca !== 'Todas') filtro.epocas = texto(epoca);
    if (precoMax !== undefined) {
      if (!texto(precoMax).trim() || !Number.isFinite(Number(precoMax)) || Number(precoMax) < 0) throw erro(400, 'Preço máximo inválido');
      filtro.preco = { $lte: Number(precoMax) };
    }
    if (bio !== undefined) {
      if (!['true', 'false'].includes(bio)) throw erro(400, 'Filtro biológico inválido');
      filtro.biologico = bio === 'true';
    }
    if (produtor) filtro.produtor = id(produtor);
    if (ordenar !== undefined && !Object.hasOwn(ORDENACAO, texto(ordenar))) throw erro(400, 'Ordenação inválida');
    const lista = await Product.find(filtro).sort(ORDENACAO[ordenar] || ORDENACAO.recentes)
      .populate('produtor', 'nome produtor.localidade produtor.nomeExploracao');
    res.json(await avaliacoesProdutos(lista));
  } catch (err) { next(err); }
});

// GET /api/products/:id  -> 200 | 404
router.get('/:id', a(async (req, res) => {
  const produto = await Product.findById(id(req.params.id)).populate('produtor', 'nome produtor');
  if (!produto) throw erro(404, 'Produto não encontrado');
  res.json(produto);
}));

// POST /api/products  (produtor)  -> 201 + Location
router.post('/', auth('produtor'), produtorValidado, a(async (req, res) => {
  const produto = await Product.create({ ...escolher(objeto(req.body), CAMPOS), produtor: req.user.id });
  res.status(201).location(`/api/products/${produto._id}`).json(produto);
}));

// PUT /api/products/:id  (produtor dono)  -> 200 | 404
router.put('/:id', auth('produtor'), a(async (req, res) => {
  const produto = await Product.findOneAndUpdate({ _id: id(req.params.id), produtor: req.user.id },
    { $set: escolher(objeto(req.body), CAMPOS) }, { new: true, runValidators: true });
  if (!produto) throw erro(404, 'Produto não encontrado');
  res.json(produto);
}));

// DELETE /api/products/:id  (produtor dono)  -> 204 | 404
router.delete('/:id', auth('produtor'), a(async (req, res) => {
  const resultado = await Product.deleteOne({ _id: id(req.params.id), produtor: req.user.id });
  if (!resultado.deletedCount) throw erro(404, 'Produto não encontrado');
  res.status(204).end();
}));

// POST /api/products/:id/imagem  (multipart, campo "imagem")  -> 200 { imagemUrl }
router.post('/:id/imagem', auth('produtor'), upload.single('imagem'), a(async (req, res) => {
  const filtro = { _id: id(req.params.id), produtor: req.user.id };
  if (!await Product.exists(filtro)) throw erro(404, 'Produto não encontrado');
  if (!req.file) throw erro(400, 'Envie uma imagem');
  const imagemUrl = await imagens.guardarImagem(req.file, req);
  const produto = await Product.findOneAndUpdate(filtro, { $set: { imagemUrl } }, { new: true });
  if (!produto) throw erro(404, 'Produto não encontrado');
  res.json({ imagemUrl });
}));

module.exports = router;

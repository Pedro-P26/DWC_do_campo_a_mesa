// Páginas públicas dos produtores
const router = require('express').Router();
const { isObjectIdOrHexString, Types } = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const a = require('../utils/async');
const { escaparRegex, objeto, texto } = require('../utils/validar');
const auth = require('../middleware/auth');
const erro = require('../utils/erro');

router.patch('/me', auth('produtor'), a(async (req, res) => {
  const corpo = objeto(req.body);
  const campos = {};
  for (const [campo, limite] of Object.entries({ nomeExploracao: 150, descricao: 1000, localidade: 150 })) {
    if (corpo[campo] === undefined) continue;
    const valor = texto(corpo[campo]).trim();
    if (valor.length > limite || (campo !== 'descricao' && !valor)) throw erro(400, 'Dados da página pública inválidos');
    campos[`produtor.${campo}`] = valor;
  }
  if (corpo.localizacao !== undefined) {
    const p = corpo.localizacao;
    if (p !== null && (!p || typeof p !== 'object' || Array.isArray(p) || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180)) throw erro(400, 'Coordenadas inválidas');
    campos['produtor.localizacao'] = p === null ? null : { lat: p.lat, lng: p.lng };
  }
  if (!Object.keys(campos).length) throw erro(400, 'Indique os dados a atualizar');
  const conta = await User.findOneAndUpdate({ _id: req.user.id, papel: 'produtor' }, { $set: campos }, { new: true, runValidators: true });
  if (!conta) throw erro(404, 'Produtor não encontrado');
  res.json(conta.publico());
}));

// GET /api/producers?localidade=  -> 200 [produtores validados]
router.get('/', a(async (req, res) => {
  const filtro = { papel: 'produtor', 'produtor.validado': true };
  if (req.query.localidade) filtro['produtor.localidade'] = { $regex: escaparRegex(req.query.localidade), $options: 'i' };
  res.json(await User.find(filtro).select('nome produtor').sort({ nome: 1 }));
}));

// GET /api/producers/:id  -> 200 { produtor, produtos, avaliacaoMedia }
router.get('/:id', async (req, res, next) => {
  try {
    if (!isObjectIdOrHexString(req.params.id)) return res.status(404).json({ erro: 'Produtor não encontrado' });
    const produtor = await User.findOne({
      _id: req.params.id, papel: 'produtor', 'produtor.validado': true
    }).select('nome produtor');
    if (!produtor) return res.status(404).json({ erro: 'Produtor não encontrado' });
    const [produtos, avaliacoes] = await Promise.all([
      Product.find({ produtor: produtor._id }),
      Review.aggregate([
        { $match: { produtor: new Types.ObjectId(req.params.id), visivel: true } },
        { $group: { _id: null, media: { $avg: '$classificacao' } } }
      ])
    ]);
    res.json({ produtor, produtos, avaliacaoMedia: avaliacoes[0]?.media ?? null });
  } catch (err) { next(err); }
});

module.exports = router;

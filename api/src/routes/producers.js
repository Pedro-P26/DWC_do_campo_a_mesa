// Páginas públicas dos produtores
const router = require('express').Router();
const { isObjectIdOrHexString, Types } = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Review = require('../models/Review');
const porFazer = require('./_naoImplementado');

// GET /api/producers?localidade=  -> 200 [produtores validados]
router.get('/', porFazer('Listar produtores validados'));

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

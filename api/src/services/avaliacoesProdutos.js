const Review = require('../models/Review');

// Uma agregação para toda a lista; avaliações ocultas e só do produtor não entram.
module.exports = async function avaliacoesProdutos(produtos) {
  if (!produtos.length) return [];
  const estatisticas = await Review.aggregate([
    { $match: { produto: { $in: produtos.map(p => p._id) }, visivel: true } },
    { $group: { _id: '$produto', media: { $avg: '$classificacao' }, total: { $sum: 1 } } }
  ]);
  const porProduto = new Map(estatisticas.map(e => [String(e._id), e]));
  return produtos.map(produto => {
    const e = porProduto.get(String(produto._id));
    const dados = typeof produto.toJSON === 'function' ? produto.toJSON() : produto;
    return { ...dados, avaliacaoMedia: e?.media ?? null, numeroAvaliacoes: e?.total ?? 0 };
  });
};

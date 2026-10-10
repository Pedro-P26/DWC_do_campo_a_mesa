const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Order = require('../models/Order');
const erro = require('../utils/erro');
const cent = valor => Math.round((valor + Number.EPSILON) * 100) / 100;

async function licitar(leilaoId, valor, user) {
  if (user.papel !== 'comprador') throw erro(403, 'Só compradores podem licitar');
  if (!mongoose.isValidObjectId(leilaoId) || typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0 || valor > 1e9) throw erro(400, 'Licitação inválida');
  valor = cent(valor);
  let aceite;
  await mongoose.connection.transaction(async session => {
    const agora = new Date();
    const leilao = await Auction.findOneAndUpdate({ _id: leilaoId, estado: 'ativo',
      iniciaEm: { $lte: agora }, terminaEm: { $gt: agora },
      $expr: { $lte: [{ $round: [{ $add: ['$licitacaoAtual.valor', '$incremento'] }, 2] }, valor] } },
    { $set: { licitacaoAtual: { valor, comprador: user.id, nome: user.nome, em: agora } },
      $inc: { numLicitacoes: 1 } }, { new: true, session });
    if (!leilao) {
      const atual = await Auction.findById(leilaoId).session(session);
      if (!atual) throw erro(404, 'Leilão não encontrado');
      if (atual.estado !== 'ativo' || atual.terminaEm <= agora || atual.iniciaEm > agora) throw erro(409, 'O leilão não está ativo');
      throw erro(409, `Licitação mínima: ${cent(atual.licitacaoAtual.valor + atual.incremento).toFixed(2)} €`);
    }
    const [bid] = await Bid.create([{ leilao: leilaoId, comprador: user.id, nome: user.nome, valor }], { session });
    aceite = { ...bid.toObject(), numLicitacoes: leilao.numLicitacoes, leilaoId: String(leilaoId) };
  });
  return aceite;
}

async function ciclo(io) {
  const agora = new Date();
  const agendados = await Auction.find({ estado: 'agendado', iniciaEm: { $lte: agora } }).select('_id');
  for (const { _id } of agendados) {
    const l = await Auction.findOneAndUpdate({ _id, estado: 'agendado', iniciaEm: { $lte: agora } }, { $set: { estado: 'ativo' } }, { new: true });
    if (l) io.to(`leilao:${_id}`).emit('aberto', { id: String(_id) });
  }
  const expirados = await Auction.find({ estado: 'ativo', terminaEm: { $lte: agora } }).select('_id');
  for (const { _id } of expirados) {
    let resultado;
    await mongoose.connection.transaction(async session => {
      resultado = null;
      const l = await Auction.findOneAndUpdate({ _id, estado: 'ativo', terminaEm: { $lte: new Date() } },
        { $set: { estado: 'terminado' } }, { new: true, session });
      if (!l) return;
      const vencedor = l.licitacaoAtual?.comprador;
      let encomenda;
      if (vencedor) {
        [encomenda] = await Order.create([{ comprador: vencedor, produtor: l.produtor,
          linhas: [{ produto: l.produto, nome: `Lote: ${l.lote}`, precoUnit: l.licitacaoAtual.valor, unidade: 'lote', quantidade: 1 }],
          estado: 'confirmada', origem: 'leilao', leilao: l._id }], { session });
        await Auction.updateOne({ _id }, { $set: { encomenda: encomenda._id } }, { session });
      }
      resultado = { l, encomenda };
    });
    if (!resultado) continue;
    const { l, encomenda } = resultado;
    const dados = { id: String(l._id), lote: l.lote, vencedor: l.licitacaoAtual.comprador
      ? { id: String(l.licitacaoAtual.comprador), nome: l.licitacaoAtual.nome } : null,
    valor: l.licitacaoAtual.valor, encomenda: encomenda ? String(encomenda._id) : null };
    io.to(`leilao:${l._id}`).emit('terminado', dados);
    io.to(`user:${l.produtor}`).emit('leilao-terminado', dados);
    if (dados.vencedor) io.to(`user:${dados.vencedor.id}`).emit('leilao-ganho', dados);
  }
}
module.exports = { licitar, ciclo };

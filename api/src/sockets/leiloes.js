const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const { licitar } = require('../services/tempoReal');
const sala = id => `leilao:${id}`;
function presenca(io, id) { io.to(sala(id)).emit('presenca', io.sockets.adapter.rooms.get(sala(id))?.size ?? 0); }
module.exports = (io, socket) => {
  function valido() {
    try { jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET); return true; }
    catch { socket.emit('recusada', 'Sessão expirada'); socket.disconnect(); return false; }
  }
  socket.on('entrar', async id => {
    if (!valido()) return;
    try {
      if (!mongoose.isValidObjectId(id)) return socket.emit('recusada', 'Leilão inválido');
      const leilao = await Auction.findById(id).populate('produtor', 'nome produtor.localidade produtor.nomeExploracao').populate('produto', 'imagemUrl');
      if (!leilao) return socket.emit('recusada', 'Leilão não encontrado');
      await socket.join(sala(id));
      const licitacoes = await Bid.find({ leilao: id }).sort({ createdAt: -1, _id: -1 }).limit(20);
      socket.emit('estado', { agora: new Date(), leilao, licitacoes });
      presenca(io, id);
    } catch (err) { console.error(err); socket.emit('recusada', 'Não foi possível carregar o leilão'); }
  });
  socket.on('sair', async id => { if (typeof id !== 'string') return; await socket.leave(sala(id)); presenca(io, id); });
  socket.on('licitar', async (dados, ack) => {
    const responder = r => { if (typeof ack === 'function') ack(r); };
    if (!valido()) return responder({ ok: false, erro: 'Sessão expirada' });
    try {
      if (!dados || !socket.rooms.has(sala(dados.leilaoId))) throw Object.assign(new Error('Entre na sala antes de licitar'), { status: 400 });
      const bid = await licitar(dados.leilaoId, dados.valor, socket.user);
      io.to(sala(dados.leilaoId)).emit('nova-licitacao', bid);
      responder({ ok: true, valor: bid.valor });
    } catch (err) {
      if (!err.status) console.error(err);
      const mensagem = err.status ? err.message : 'Não foi possível guardar a licitação';
      socket.emit('recusada', mensagem); responder({ ok: false, erro: mensagem });
    }
  });
  socket.on('disconnecting', () => {
    for (const s of socket.rooms) if (s.startsWith('leilao:')) setImmediate(() => presenca(io, s.slice(7)));
  });
};

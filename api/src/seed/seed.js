// Dados de exemplo: npm run seed (APAGA as seis coleções da base configurada).
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
const Auction = require('../models/Auction');
const Order = require('../models/Order');
const Bid = require('../models/Bid');
const Review = require('../models/Review');
const { ligarBD } = require('../config/db');

async function popularBD() {
  const modelos = [User, Product, Order, Auction, Bid, Review];
  await Promise.all(modelos.map(M => M.init()));
  await Promise.all(modelos.map(M => M.deleteMany({})));

  const passwordHash = await bcrypt.hash('password123', 12);
  const [admin, horta, mel, comprador] = await User.create([
    { nome: 'Administração', email: 'admin@exemplo.pt', passwordHash, papel: 'admin' },
    { nome: 'Horta da Ribeira', email: 'horta@exemplo.pt', passwordHash, papel: 'produtor',
      produtor: { nomeExploracao: 'Horta da Ribeira', localidade: 'Ponte de Lima', validado: true } },
    { nome: 'Mel do Soajo', email: 'mel@exemplo.pt', passwordHash, papel: 'produtor',
      produtor: { nomeExploracao: 'Mel do Soajo', localidade: 'Arcos de Valdevez', validado: true } },
    { nome: 'Tasca do Lima', email: 'tasca@exemplo.pt', passwordHash, papel: 'comprador' }
  ]);

  const [kiwi, abobora, couve, melUrze] = await Product.create([
    { produtor: horta._id, nome: 'Kiwi Hayward', categoria: 'Fruta', preco: 2.4, unidade: 'kg', stock: 300, biologico: true, epocas: ['Outono', 'Inverno'] },
    { produtor: horta._id, nome: 'Abóbora-menina', categoria: 'Hortícolas', preco: 1.2, unidade: 'kg', stock: 80, epocas: ['Outono'] },
    { produtor: horta._id, nome: 'Couve-galega', categoria: 'Hortícolas', preco: 1.5, unidade: 'molho', stock: 40, biologico: true, epocas: ['Outono', 'Inverno'] },
    { produtor: mel._id, nome: 'Mel de urze', categoria: 'Mel', preco: 7.5, unidade: '500 g', stock: 38 },
    { produtor: mel._id, nome: 'Mel de castanheiro', categoria: 'Mel', preco: 7.0, unidade: '500 g', stock: 21 }
  ]);

  const agora = Date.now();
  const entregue = await Order.create({ comprador: comprador._id, produtor: horta._id, estado: 'entregue',
    linhas: [{ produto: kiwi._id, nome: kiwi.nome, precoUnit: kiwi.preco, unidade: kiwi.unidade, quantidade: 2 }],
    entrega: { tipo: 'levantamento' } });
  await Order.create({ comprador: comprador._id, produtor: mel._id,
    linhas: [{ produto: melUrze._id, nome: melUrze.nome, precoUnit: melUrze.preco, unidade: melUrze.unidade, quantidade: 2 }],
    entrega: { tipo: 'entrega', morada: 'Rua de exemplo, Ponte de Lima' } });
  await Review.create({ autor: comprador._id, produtor: horta._id, produto: kiwi._id, encomenda: entregue._id,
    classificacao: 5, comentario: 'Kiwi fresco e entrega pontual.' });
  await Auction.create({
    produtor: horta._id, produto: kiwi._id, lote: '200 kg de kiwi Hayward, calibre A', quantidade: '200 kg',
    descricao: 'Excedente da colheita, em caixas de 10 kg.',
    precoBase: 200, incremento: 5, licitacaoAtual: { valor: 200 },
    iniciaEm: new Date(agora), terminaEm: new Date(agora + 30 * 60 * 1000), estado: 'ativo'
  });
  await Auction.create({ produtor: horta._id, produto: couve._id, lote: '10 molhos de couve-galega', quantidade: '10 molhos',
    precoBase: 10, incremento: 1, licitacaoAtual: { valor: 10 },
    iniciaEm: new Date(agora + 60 * 60000), terminaEm: new Date(agora + 90 * 60000), estado: 'agendado' });
  const terminado = await Auction.create({ produtor: horta._id, produto: abobora._id,
    lote: 'Lote de 5 kg de abóbora-menina', quantidade: '5 kg', precoBase: 6, incremento: 1,
    licitacaoAtual: { valor: 7, comprador: comprador._id, nome: comprador.nome, em: new Date(agora - 40 * 60000) },
    numLicitacoes: 1, iniciaEm: new Date(agora - 60 * 60000), terminaEm: new Date(agora - 30 * 60000), estado: 'terminado' });
  await Bid.create({ leilao: terminado._id, comprador: comprador._id, nome: comprador.nome, valor: 7,
    createdAt: new Date(agora - 40 * 60000) });
  const encomendaLeilao = await Order.create({ comprador: comprador._id, produtor: horta._id, origem: 'leilao', leilao: terminado._id,
    linhas: [{ produto: abobora._id, nome: terminado.lote, precoUnit: 7, unidade: 'lote', quantidade: 1 }] });
  await Auction.updateOne({ _id: terminado._id }, { $set: { encomenda: encomendaLeilao._id } });

  console.log('Seed concluído. Utilizadores (password: password123):');
  console.log([admin, horta, mel, comprador].map((u) => `  ${u.papel.padEnd(10)} ${u.email}`).join('\n'));
}

async function seed() {
  try {
    await ligarBD();
    await popularBD();
    console.log('Avaliações de demonstração:', await require('./avaliacoes').carregarAvaliacoesDemo());
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  require('dotenv').config();
  seed().catch((err) => { console.error(err); process.exitCode = 1; });
}

module.exports = { popularBD };

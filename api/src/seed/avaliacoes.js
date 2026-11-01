// Acrescenta dados de demonstração. Não apaga coleções nem altera stock/preços.
const { createHash } = require('node:crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');

const PASSWORD_DEMO = 'DemoAvaliacoes123!';
const CONTAS_DEMO = [
  { nome: 'Ana Silva', email: 'avaliacoes.ana@demo.exemplo.pt' },
  { nome: 'João Costa', email: 'avaliacoes.joao@demo.exemplo.pt' },
  { nome: 'Sofia Martins', email: 'avaliacoes.sofia@demo.exemplo.pt' }
];
const COMENTARIOS = [
  'Produto com boa apresentação e qualidade consistente.',
  'Correspondeu à descrição e chegou bem acondicionado.',
  'Muito satisfeito com esta encomenda. Voltarei a comprar.',
  'Boa qualidade e contacto fácil com o produtor.',
  'Entrega cuidada e produto conforme o anunciado.',
  'Uma boa experiência de compra junto de um produtor local.'
];

// IDs estáveis permitem repetir o seed sem acrescentar cópias e sem repor moderação.
const idDemo = chave => new mongoose.Types.ObjectId(createHash('sha256').update(`avaliacoes-demo-v1:${chave}`).digest('hex').slice(0, 24));

async function carregarAvaliacoesDemo() {
  await Promise.all([User, Product, Order, Review].map(modelo => modelo.init()));
  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 12);
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const produtos = await Product.find().sort({ _id: 1 }).session(session).lean();
      const resultado = { produtos: produtos.length, utilizadoresCriados: 0, encomendasCriadas: 0,
        encomendasAtualizadas: 0, avaliacoesCriadas: 0, avaliacoesDenunciadasCriadas: 0, avaliacoesOcultasCriadas: 0 };
      if (!produtos.length) return resultado;
      const grupos = new Map();
      for (const produto of produtos) {
        const chave = String(produto.produtor);
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(produto);
      }
      const produtores = await User.countDocuments({ _id: { $in: [...grupos.keys()] }, papel: 'produtor' }).session(session);
      if (produtores !== grupos.size) throw new Error('Existem produtos sem um produtor válido; nenhum dado foi inserido.');

      const contas = [];
      for (const conta of CONTAS_DEMO) {
        let utilizador = await User.findOne({ email: conta.email }).session(session);
        if (!utilizador) {
          [utilizador] = await User.create([{ ...conta, papel: 'comprador', passwordHash }], { session });
          resultado.utilizadoresCriados++;
        }
        if (utilizador.papel !== 'comprador' || utilizador.nome !== conta.nome) {
          throw new Error('Uma conta reservada ao seed já existe com outros dados; operação cancelada.');
        }
        contas.push(utilizador);
      }

      const ordens = new Map();
      for (const [produtor, lista] of grupos) {
        for (const autor of contas.slice(0, 2)) {
          const _id = idDemo(`encomenda:${produtor}:${autor.email}`);
          const existente = await Order.findById(_id).session(session);
          const linha = p => ({ produto: p._id, nome: p.nome, precoUnit: p.preco, unidade: p.unidade, quantidade: 1 });
          if (existente) {
            if (String(existente.comprador) !== String(autor._id) || String(existente.produtor) !== produtor ||
              existente.estado !== 'entregue' || existente.origem !== 'loja') {
              throw new Error('Uma encomenda reservada ao seed foi alterada; operação cancelada.');
            }
            const novas = lista.filter(p => !existente.linhas.some(l => String(l.produto) === String(p._id)));
            if (novas.length) {
              await Order.updateOne({ _id }, { $push: { linhas: { $each: novas.map(linha) } } }, { session, runValidators: true });
              resultado.encomendasAtualizadas++;
            }
          } else {
            await Order.create([{ _id, comprador: autor._id, produtor, estado: 'entregue',
              entrega: { tipo: 'levantamento' }, linhas: lista.map(linha) }], { session });
            resultado.encomendasCriadas++;
          }
          ordens.set(`${produtor}:${autor.email}`, _id);
        }
      }

      for (const [indice, produto] of produtos.entries()) {
        for (const [posicao, autor] of contas.slice(0, 2).entries()) {
          const _id = idDemo(`avaliacao:${produto._id}:${autor.email}`);
          const encomenda = ordens.get(`${produto.produtor}:${autor.email}`);
          const existente = await Review.findById(_id).session(session);
          if (existente) {
            if (String(existente.autor) !== String(autor._id) || String(existente.produto) !== String(produto._id) ||
              String(existente.produtor) !== String(produto.produtor) || String(existente.encomenda) !== String(encomenda)) {
              throw new Error('Uma avaliação reservada ao seed tem associações diferentes; operação cancelada.');
            }
            continue; // Preservar visibilidade, denúncias e qualquer moderação anterior.
          }
          const denunciada = posicao === 1 && indice % 5 === 0;
          const oculta = denunciada && indice % 10 === 0;
          const denunciantes = denunciada ? [contas[0]._id, contas[2]._id] : [];
          await Review.create([{ _id, autor: autor._id, produto: produto._id, produtor: produto.produtor, encomenda,
            classificacao: denunciada ? 2 : (posicao === 0 ? 5 - indice % 2 : 4),
            comentario: denunciada
              ? 'Visitem a minha loja para encontrar promoções de outros vendedores. Tenho ofertas melhores!'
              : COMENTARIOS[(indice + posicao * 3) % COMENTARIOS.length],
            denuncias: denunciantes.length, denunciantes, visivel: !oculta
          }], { session });
          resultado.avaliacoesCriadas++;
          resultado.avaliacoesDenunciadasCriadas += Number(denunciada);
          resultado.avaliacoesOcultasCriadas += Number(oculta);
        }
      }
      return resultado;
    });
  } finally { await session.endSession(); }
}

async function main() {
  require('dotenv').config({ quiet: true });
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI não está definida');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    console.log(`Base de dados: ${mongoose.connection.name}`);
    console.log(JSON.stringify(await carregarAvaliacoesDemo(), null, 2));
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) main().catch(err => { console.error(err.name + ': ' + err.message.replace(/mongodb(?:\+srv)?:\/\/\S+/gi, '[URI omitido]')); process.exitCode = 1; });
module.exports = { carregarAvaliacoesDemo, PASSWORD_DEMO, CONTAS_DEMO };

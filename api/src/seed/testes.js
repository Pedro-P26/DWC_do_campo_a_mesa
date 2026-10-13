const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');

const PASSWORD_TESTE = 'Testes123!';
const contas = [
  { nome: 'Administração de testes', email: 'admin@teste.exemplo.pt', papel: 'admin' },
  { nome: 'Horta da Ribeira', email: 'horta@teste.exemplo.pt', papel: 'produtor',
    produtor: { nomeExploracao: 'Horta da Ribeira', localidade: 'Ponte de Lima', descricao: 'Exploração de demonstração com fruta e hortícolas da época.', validado: true } },
  { nome: 'Mel do Soajo', email: 'mel@teste.exemplo.pt', papel: 'produtor',
    produtor: { nomeExploracao: 'Mel do Soajo', localidade: 'Arcos de Valdevez', descricao: 'Produtor de demonstração com diferentes variedades de mel.', validado: true } },
  { nome: 'Quinta da Lameira', email: 'lameira@teste.exemplo.pt', papel: 'produtor',
    produtor: { nomeExploracao: 'Quinta da Lameira', localidade: 'Monção', descricao: 'Quinta de demonstração com vinho Alvarinho.', validado: true } },
  { nome: 'Casal do Vez', email: 'casal@teste.exemplo.pt', papel: 'produtor',
    produtor: { nomeExploracao: 'Casal do Vez', localidade: 'Arcos de Valdevez', descricao: 'Horta de demonstração com produção biológica.', validado: true } },
  { nome: 'Queijaria da Peneda', email: 'queijaria@teste.exemplo.pt', papel: 'produtor',
    produtor: { nomeExploracao: 'Queijaria da Peneda', localidade: 'Melgaço', descricao: 'Queijaria de demonstração com queijo fresco e curado.', validado: true } },
  { nome: 'Forno de Lanheses', email: 'forno@teste.exemplo.pt', papel: 'produtor',
    produtor: { nomeExploracao: 'Forno de Lanheses', localidade: 'Viana do Castelo', descricao: 'Padaria de demonstração com broa e pão de centeio.', validado: true } },
  { nome: 'Souto da Serra', email: 'souto@teste.exemplo.pt', papel: 'produtor',
    produtor: { nomeExploracao: 'Souto da Serra', localidade: 'Paredes de Coura', descricao: 'Produtor de demonstração com castanha da época.', validado: true } },
  { nome: 'Horta do Vez', email: 'pendente@teste.exemplo.pt', papel: 'produtor',
    produtor: { nomeExploracao: 'Horta do Vez', localidade: 'Arcos de Valdevez', descricao: 'Conta de teste para aprovação de produtores.', validado: false } },
  { nome: 'Ana Silva', email: 'ana@teste.exemplo.pt', papel: 'comprador' },
  { nome: 'João Costa', email: 'joao@teste.exemplo.pt', papel: 'comprador' },
  { nome: 'Tasca do Lima', email: 'tasca@teste.exemplo.pt', papel: 'comprador' }
];

const produtos = [
  { email: 'horta@teste.exemplo.pt', nome: 'Kiwi Hayward', categoria: 'Fruta', preco: 2.4, unidade: 'kg', stock: 300, biologico: true, epocas: ['Outono', 'Inverno'], imagemUrl: '/images/produtos/kiwi.jpg' },
  { email: 'horta@teste.exemplo.pt', nome: 'Abóbora-menina', categoria: 'Hortícolas', preco: 1.2, unidade: 'kg', stock: 80, biologico: false, epocas: ['Outono'], imagemUrl: '/images/produtos/abobora.jpg' },
  { email: 'horta@teste.exemplo.pt', nome: 'Couve-galega', categoria: 'Hortícolas', preco: 1.5, unidade: 'molho', stock: 40, biologico: true, epocas: ['Outono', 'Inverno'], imagemUrl: '/images/produtos/couve.jpg' },
  { email: 'mel@teste.exemplo.pt', nome: 'Mel de urze', categoria: 'Mel', preco: 7.5, unidade: '500 g', stock: 38, biologico: false, epocas: ['Primavera', 'Verão'], imagemUrl: '/images/produtos/mel.jpg' },
  { email: 'mel@teste.exemplo.pt', nome: 'Mel de castanheiro', categoria: 'Mel', preco: 7, unidade: '500 g', stock: 21, biologico: false, epocas: ['Verão', 'Outono'], imagemUrl: '/images/produtos/mel-castanheiro.jpg', imagensAnteriores: ['/images/produtos/mel.jpg'] },
  { email: 'lameira@teste.exemplo.pt', nome: 'Alvarinho 2025', categoria: 'Vinho', preco: 9.9, unidade: 'garrafa', stock: 24, biologico: false, epocas: ['Outono'], imagemUrl: '/images/produtos/vinho.jpg' },
  { email: 'casal@teste.exemplo.pt', nome: 'Batata branca', categoria: 'Hortícolas', preco: 1.1, unidade: 'kg', stock: 3, biologico: true, epocas: ['Verão', 'Outono'], imagemUrl: '/images/produtos/batata.jpg' },
  { email: 'queijaria@teste.exemplo.pt', nome: 'Queijo de cabra curado', categoria: 'Queijo', preco: 6.8, unidade: 'unid.', stock: 16, biologico: false, epocas: ['Primavera', 'Verão', 'Outono', 'Inverno'], imagemUrl: '/images/produtos/queijo.jpg' },
  { email: 'queijaria@teste.exemplo.pt', nome: 'Queijo fresco', categoria: 'Queijo', preco: 3.5, unidade: 'unid.', stock: 0, biologico: false, epocas: ['Primavera', 'Verão', 'Outono', 'Inverno'], imagemUrl: '/images/produtos/queijo-fresco.jpg' },
  { email: 'forno@teste.exemplo.pt', nome: 'Broa de milho', categoria: 'Padaria', preco: 3.2, unidade: 'unid.', stock: 12, biologico: false, epocas: ['Primavera', 'Verão', 'Outono', 'Inverno'], imagemUrl: '/images/produtos/broa.jpg' },
  { email: 'forno@teste.exemplo.pt', nome: 'Pão de centeio', categoria: 'Padaria', preco: 2.8, unidade: 'unid.', stock: 5, biologico: false, epocas: ['Primavera', 'Verão', 'Outono', 'Inverno'], imagemUrl: '/images/produtos/pao-centeio.jpg', imagensAnteriores: ['/images/produtos/broa.jpg'] },
  { email: 'souto@teste.exemplo.pt', nome: 'Castanha longal', categoria: 'Outros', preco: 4.5, unidade: 'kg', stock: 30, biologico: false, epocas: ['Outono'], imagemUrl: '/images/produtos/castanha.jpg' },
  { email: 'horta@teste.exemplo.pt', nome: 'Maçã Gala', categoria: 'Fruta', preco: 1.9, unidade: 'kg', stock: 60, biologico: true, epocas: ['Outono', 'Inverno'], imagemUrl: '/images/produtos/maca.jpg' },
  { email: 'horta@teste.exemplo.pt', nome: 'Pera Rocha', categoria: 'Fruta', preco: 2.2, unidade: 'kg', stock: 45, biologico: false, epocas: ['Verão', 'Outono'], imagemUrl: '/images/produtos/pera.jpg' },
  { email: 'horta@teste.exemplo.pt', nome: 'Morango', categoria: 'Fruta', preco: 4.5, unidade: 'kg', stock: 20, biologico: true, epocas: ['Primavera', 'Verão'], imagemUrl: '/images/produtos/morango.jpg' },
  { email: 'casal@teste.exemplo.pt', nome: 'Cenoura', categoria: 'Hortícolas', preco: 1.4, unidade: 'kg', stock: 70, biologico: true, epocas: ['Primavera', 'Verão', 'Outono', 'Inverno'], imagemUrl: '/images/produtos/cenoura.jpg' },
  { email: 'casal@teste.exemplo.pt', nome: 'Tomate', categoria: 'Hortícolas', preco: 2.5, unidade: 'kg', stock: 35, biologico: true, epocas: ['Verão', 'Outono'], imagemUrl: '/images/produtos/tomate.jpg' },
  { email: 'casal@teste.exemplo.pt', nome: 'Cebola roxa', categoria: 'Hortícolas', preco: 1.8, unidade: 'kg', stock: 50, biologico: false, epocas: ['Verão', 'Outono'], imagemUrl: '/images/produtos/cebola-roxa.jpg' },
  { email: 'lameira@teste.exemplo.pt', nome: 'Vinho tinto regional', categoria: 'Vinho', preco: 8.5, unidade: 'garrafa', stock: 30, biologico: false, epocas: ['Outono'], imagemUrl: '/images/produtos/vinho-tinto.jpg' },
  { email: 'queijaria@teste.exemplo.pt', nome: 'Queijo de ovelha', categoria: 'Queijo', preco: 8.9, unidade: 'unid.', stock: 18, biologico: false, epocas: ['Primavera', 'Verão', 'Outono', 'Inverno'], imagemUrl: '/images/produtos/queijo-ovelha.jpg' },
  { email: 'forno@teste.exemplo.pt', nome: 'Pão integral', categoria: 'Padaria', preco: 3.1, unidade: 'unid.', stock: 14, biologico: false, epocas: ['Primavera', 'Verão', 'Outono', 'Inverno'], imagemUrl: '/images/produtos/pao-integral.jpg' },
  { email: 'souto@teste.exemplo.pt', nome: 'Noz com casca', categoria: 'Outros', preco: 6.5, unidade: 'kg', stock: 25, biologico: false, epocas: ['Outono', 'Inverno'], imagemUrl: '/images/produtos/noz.jpg' },
  { email: 'souto@teste.exemplo.pt', nome: 'Avelã', categoria: 'Outros', preco: 7.8, unidade: 'kg', stock: 22, biologico: false, epocas: ['Verão', 'Outono'], imagemUrl: '/images/produtos/avela.jpg' },
  { email: 'mel@teste.exemplo.pt', nome: 'Mel multifloral', categoria: 'Mel', preco: 6.9, unidade: '500 g', stock: 30, biologico: false, epocas: ['Primavera', 'Verão'], imagemUrl: '/images/produtos/mel-multifloral.jpg' }
];

const fotografiasOriginais = [
  { email: 'horta@exemplo.pt', nome: 'Kiwi Hayward', anterior: '/images/produtos/kiwi.jpg', imagemUrl: '/images/produtos/kiwi-original.jpg' },
  { email: 'horta@exemplo.pt', nome: 'Abóbora-menina', anterior: '/images/produtos/abobora.jpg', imagemUrl: '/images/produtos/abobora-original.jpg' },
  { email: 'horta@exemplo.pt', nome: 'Couve-galega', anterior: '/images/produtos/couve.jpg', imagemUrl: '/images/produtos/couve-original.jpg' },
  { email: 'mel@exemplo.pt', nome: 'Mel de urze', anterior: '/images/produtos/mel.jpg', imagemUrl: '/images/produtos/mel-urze-original.jpg' },
  { email: 'mel@exemplo.pt', nome: 'Mel de castanheiro', anterior: '/images/produtos/mel.jpg', imagemUrl: '/images/produtos/mel-castanheiro-original.jpg' }
];

async function carregarTestes() {
  const urls = [...produtos, ...fotografiasOriginais].map(p => p.imagemUrl);
  if (urls.some(url => !url) || new Set(urls).size !== urls.length) throw new Error('Cada produto de demonstração deve ter uma imagem diferente');
  await Promise.all([User.init(), Product.init()]);
  const passwordHash = await bcrypt.hash(PASSWORD_TESTE, 12);
  const utilizadores = new Map();
  let utilizadoresCriados = 0;
  let produtosCriados = 0;
  let imagensPreenchidas = 0;

  // Inserir apenas dados novos: repetir o comando preserva alterações feitas nos testes.
  for (const conta of contas) {
    const resultado = await User.updateOne({ email: conta.email }, {
      $setOnInsert: { ...conta, passwordHash }
    }, { upsert: true, runValidators: true });
    utilizadoresCriados += resultado.upsertedCount;
    const utilizador = await User.findOne({ email: conta.email });
    if (utilizador.papel !== conta.papel) throw new Error(`A conta ${conta.email} já existe com outro papel`);
    utilizadores.set(conta.email, utilizador);
  }

  for (const { email, imagensAnteriores = [], ...produto } of produtos) {
    const produtor = utilizadores.get(email)._id;
    const resultado = await Product.updateOne({ produtor, nome: produto.nome }, {
      $setOnInsert: { ...produto, produtor, descricao: `Produto de demonstração: ${produto.nome}.` }
    }, { upsert: true, runValidators: true });
    produtosCriados += resultado.upsertedCount;
    const imagem = await Product.updateOne({
      produtor, nome: produto.nome,
      $or: [{ imagemUrl: { $exists: false } }, { imagemUrl: null }, { imagemUrl: '' }, { imagemUrl: { $in: imagensAnteriores } }]
    }, { $set: { imagemUrl: produto.imagemUrl } }, { runValidators: true });
    imagensPreenchidas += imagem.modifiedCount;
  }

  // Substituir apenas fotografias partilhadas conhecidas do seed original.
  const originais = await User.find({ email: { $in: fotografiasOriginais.map(p => p.email) }, papel: 'produtor' }).select('_id email');
  for (const foto of fotografiasOriginais) {
    const produtor = originais.find(u => u.email === foto.email);
    if (!produtor) continue;
    const resultado = await Product.updateOne({ produtor: produtor._id, nome: foto.nome, imagemUrl: foto.anterior }, {
      $set: { imagemUrl: foto.imagemUrl }
    }, { runValidators: true });
    imagensPreenchidas += resultado.modifiedCount;
  }

  return { utilizadoresCriados, produtosCriados, imagensPreenchidas, utilizadores: [...utilizadores.values()] };
}

async function main() {
  require('dotenv').config({ quiet: true });
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI não está definida');
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    console.log(`Base de dados: ${mongoose.connection.name}`);
    const resultado = await carregarTestes();
    console.log(`Criados ${resultado.utilizadoresCriados} utilizadores e ${resultado.produtosCriados} produtos.`);
    console.log(`Atualizadas ${resultado.imagensPreenchidas} imagens em falta ou repetidas.`);
    console.log(`Password das contas novas: ${PASSWORD_TESTE}`);
    for (const u of resultado.utilizadores) {
      console.log(`${u.papel.padEnd(10)} ${u.email}${u.papel === 'produtor' && !u.produtor.validado ? ' (pendente)' : ''}`);
    }
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) {
  main().catch((err) => { console.error(err.name); process.exitCode = 1; });
}

module.exports = { carregarTestes, PASSWORD_TESTE };

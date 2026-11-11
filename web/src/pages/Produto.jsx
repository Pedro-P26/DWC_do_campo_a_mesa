import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Leaf, MapPin, Package, ShoppingBasket, Star } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { USAR_DADOS_SIMULADOS } from '../api/client.js';
import produtosSimulados from '../data/produtos.json';
import CartaoAvaliacao from '../components/CartaoAvaliacao.jsx';
import MapaProdutor from '../components/MapaProdutor.jsx';

export default function Produto() {
  const { id } = useParams();
  return <DetalhesProduto key={id} id={id} />;
}

function DetalhesProduto({ id }) {
  const consulta = useApi(USAR_DADOS_SIMULADOS ? null : `/products/${encodeURIComponent(id)}`);
  const avaliacoes = useApi(USAR_DADOS_SIMULADOS ? null : `/reviews?produto=${encodeURIComponent(id)}`);
  const { utilizador } = useAuth();
  const carrinho = useCarrinho();
  const [imagemFalhada, setImagemFalhada] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const produto = USAR_DADOS_SIMULADOS ? produtosSimulados.find(p => p._id === id) : consulta.dados;
  const voltar = <Link to="/" className="ligacao-voltar"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao catálogo</Link>;

  if (!USAR_DADOS_SIMULADOS && consulta.aCarregar) return <>{voltar}<p role="status">A carregar produto…</p></>;
  if (consulta.erro) return <>{voltar}<h1>Não foi possível carregar o produto</h1>
    <p className="alert alert-danger" role="alert">{consulta.erro}</p>
    <button className="btn btn-outline-primary" onClick={consulta.recarregar}>Tentar novamente</button>
  </>;
  if (!produto) return <>{voltar}<h1>Produto não encontrado</h1></>;

  const produtor = produto.produtor;
  const notas = avaliacoes.dados || [];
  const media = notas.length ? notas.reduce((s, r) => s + r.classificacao, 0) / notas.length : null;
  return <div className="pagina-produto">
    {voltar}
    <section className="produto-detalhe" aria-labelledby="titulo-produto">
      <div className="produto-detalhe__media">
        {produto.imagemUrl && !imagemFalhada ? <img className="produto-detalhe__imagem" src={produto.imagemUrl}
          alt={produto.nome} onError={() => setImagemFalhada(true)} /> :
          <div className="produto-detalhe__sem-imagem"><Package size={48} aria-hidden="true" /><span>Sem fotografia disponível</span></div>}
        {produto.biologico && <span className="produto-detalhe__bio"><Leaf size={14} aria-hidden="true" /> Produção biológica</span>}
      </div>
      <div className="produto-detalhe__informacao">
        <p className="pagina-sobretitulo">{produto.categoria} · Produção local</p>
        <h1 id="titulo-produto">{produto.nome}</h1>
        {media !== null && <a href="#titulo-avaliacoes-produto" className="produto-detalhe__avaliacao"><Star size={17} aria-hidden="true" />
          <strong>{media.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} / 5</strong><span>({notas.length} {notas.length === 1 ? 'avaliação' : 'avaliações'})</span></a>}
        <div className="produto-detalhe__origem">
          <span className="produto-detalhe__legenda">Produzido por</span>
          {produtor?._id ? <Link to={`/produtores/${produtor._id}`}>{produtor.produtor?.nomeExploracao || produtor.nome}<ArrowUpRight size={16} aria-hidden="true" /></Link> : <span>Produtor não disponível</span>}
          {produtor?.produtor?.localidade && <p><MapPin size={15} aria-hidden="true" />{produtor.produtor.localidade}</p>}
        </div>
        <div className="produto-detalhe__compra">
          <p className="produto-detalhe__preco">{produto.preco.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}<span>/ {produto.unidade}</span></p>
          <p className={`produto-detalhe__stock${produto.stock <= 0 ? ' produto-detalhe__stock--esgotado' : ''}`}>
            {produto.stock <= 0 ? 'Esgotado' : /^\d/.test(produto.unidade)
              ? `${produto.stock} ${produto.stock === 1 ? 'embalagem' : 'embalagens'} de ${produto.unidade} ${produto.stock === 1 ? 'disponível' : 'disponíveis'}`
              : `${produto.stock} ${produto.unidade} disponíveis`}
          </p>
          {utilizador?.papel === 'comprador' && <button className="btn btn-primary" disabled={produto.stock <= 0}
            onClick={() => { carrinho.adicionar(produto); setMensagem('Produto adicionado ao carrinho.'); }}><ShoppingBasket size={18} aria-hidden="true" /> Adicionar ao carrinho</button>}
          {!utilizador && <div className="d-flex flex-wrap gap-2">
            <Link to="/registo" className="btn btn-primary">Registar para encomendar</Link>
            <Link to="/login" state={{ de: `/produtos/${id}` }} className="btn btn-outline-primary">Entrar</Link>
          </div>}
          {mensagem && <p role="status" className="alert alert-success mt-3">{mensagem} <Link to="/carrinho">Ver carrinho</Link></p>}
        </div>
      </div>
    </section>
    <section className="produto-ficha" aria-label="Informações do produto">
      <div><p className="pagina-sobretitulo">DA EXPLORAÇÃO ATÉ SI</p><h2>Sobre este produto</h2>
        <p className="produto-detalhe__descricao">{produto.descricao || 'Este produto ainda não tem descrição.'}</p>
        {!!produto.ingredientes?.length && <p>Ingredientes: {produto.ingredientes.join(', ')}</p>}
      </div>
      <div><h2>Características</h2>
        <dl className="produto-detalhe__caracteristicas">
          <div><dt>Categoria</dt><dd>{produto.categoria}</dd></div>
          <div><dt>Modo de produção</dt><dd>{produto.biologico ? 'Biológico' : 'Convencional'}</dd></div>
          <div><dt>Épocas</dt><dd>{produto.epocas?.length ? produto.epocas.join(', ') : 'Não indicadas'}</dd></div>
        </dl>
      </div>
    </section>
    <MapaProdutor produtor={produtor} />
    <section aria-labelledby="titulo-avaliacoes-produto" className="produto-avaliacoes">
      <div className="produto-avaliacoes__cabecalho"><div><p className="pagina-sobretitulo">QUEM JÁ COMPROU</p><h2 id="titulo-avaliacoes-produto">Avaliações do produto</h2></div>
      {media !== null && <div className="produto-avaliacoes__resumo"><Star size={22} aria-hidden="true" /><strong>{media.toLocaleString('pt-PT', { maximumFractionDigits: 1 })}<span> / 5</span></strong><small>{notas.length} {notas.length === 1 ? 'avaliação' : 'avaliações'}</small></div>}</div>
      {avaliacoes.aCarregar && <p role="status">A carregar avaliações…</p>}
      {avaliacoes.erro && <div className="alert alert-danger" role="alert"><p>{avaliacoes.erro}</p>
        <button className="btn btn-outline-danger" onClick={avaliacoes.recarregar}>Atualizar avaliações</button></div>}
      {!avaliacoes.aCarregar && !avaliacoes.erro && notas.length === 0 && <p>Ainda não há avaliações deste produto.</p>}
      <div className="produto-avaliacoes__lista">{notas.map(r => <CartaoAvaliacao key={r._id} avaliacao={r} />)}</div>
    </section>
  </div>;
}

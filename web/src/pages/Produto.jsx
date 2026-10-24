import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { USAR_DADOS_SIMULADOS } from '../api/client.js';
import produtosSimulados from '../data/produtos.json';

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
  const voltar = <Link to="/" className="d-inline-block mb-3">Voltar ao catálogo</Link>;

  if (!USAR_DADOS_SIMULADOS && consulta.aCarregar) return <>{voltar}<p role="status">A carregar produto…</p></>;
  if (consulta.erro) return <>{voltar}<h1>Não foi possível carregar o produto</h1>
    <p className="alert alert-danger" role="alert">{consulta.erro}</p>
    <button className="btn btn-outline-primary" onClick={consulta.recarregar}>Tentar novamente</button>
  </>;
  if (!produto) return <>{voltar}<h1>Produto não encontrado</h1></>;

  const produtor = produto.produtor;
  const notas = avaliacoes.dados || [];
  const media = notas.length ? notas.reduce((s, r) => s + r.classificacao, 0) / notas.length : null;
  return <>
    {voltar}
    <section className="row g-4 mb-4" aria-labelledby="titulo-produto">
      <div className="col-12 col-md-5">
        {produto.imagemUrl && !imagemFalhada ? <img className="produto-detalhe__imagem" src={produto.imagemUrl}
          alt={produto.nome} onError={() => setImagemFalhada(true)} /> :
          <div className="produto-detalhe__sem-imagem"><span>Sem fotografia disponível</span></div>}
      </div>
      <div className="col-12 col-md-7">
        <h1 id="titulo-produto">{produto.nome}</h1>
        <p className="fs-3 fw-bold">{produto.preco.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })} / {produto.unidade}</p>
        <p className="produto-detalhe__descricao">{produto.descricao || 'Este produto ainda não tem descrição.'}</p>
        {!!produto.ingredientes?.length && <p>Ingredientes: {produto.ingredientes.join(', ')}</p>}
        <dl>
          <dt>Categoria</dt><dd>{produto.categoria}</dd>
          <dt>Modo de produção</dt><dd>{produto.biologico ? 'Biológico' : 'Convencional'}</dd>
          <dt>Épocas</dt><dd>{produto.epocas?.length ? produto.epocas.join(', ') : 'Não indicadas'}</dd>
          <dt>Disponibilidade</dt><dd>{produto.stock > 0 ? `${produto.stock} ${produto.unidade} em stock` : 'Esgotado'}</dd>
          <dt>Produtor</dt><dd>{produtor?._id ? <Link to={`/produtores/${produtor._id}`}>{produtor.nome}</Link> : 'Não disponível'}</dd>
          {produtor?.produtor?.localidade && <><dt>Localidade</dt><dd>{produtor.produtor.localidade}</dd></>}
        </dl>
        {utilizador?.papel === 'comprador' && <button className="btn btn-primary" disabled={produto.stock <= 0}
          onClick={() => { carrinho.adicionar(produto); setMensagem('Produto adicionado ao carrinho.'); }}>Adicionar ao carrinho</button>}
        {!utilizador && <div className="d-flex flex-wrap gap-2">
          <Link to="/registo" className="btn btn-primary">Registar para encomendar</Link>
          <Link to="/login" state={{ de: `/produtos/${id}` }} className="btn btn-outline-primary">Entrar</Link>
        </div>}
        {mensagem && <p role="status" className="alert alert-success mt-3">{mensagem} <Link to="/carrinho">Ver carrinho</Link></p>}
      </div>
    </section>
    <section aria-labelledby="titulo-avaliacoes-produto">
      <h2 id="titulo-avaliacoes-produto">Avaliações do produto</h2>
      {avaliacoes.aCarregar && <p role="status">A carregar avaliações…</p>}
      {avaliacoes.erro && <div className="alert alert-danger" role="alert"><p>{avaliacoes.erro}</p>
        <button className="btn btn-outline-danger" onClick={avaliacoes.recarregar}>Atualizar avaliações</button></div>}
      {media !== null && <p>Média: {media.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} / 5 · {notas.length} avaliações</p>}
      {!avaliacoes.aCarregar && !avaliacoes.erro && notas.length === 0 && <p>Ainda não há avaliações deste produto.</p>}
      {notas.map(r => <article key={r._id} className="card p-3 mb-3">
        <h3 className="h5">{r.autor?.nome || 'Comprador'} · {r.classificacao}/5</h3>
        {r.comentario && <p className="mb-0">{r.comentario}</p>}
      </article>)}
    </section>
  </>;
}

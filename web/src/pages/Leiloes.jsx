import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock3, Gavel, MapPin, RefreshCw } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';

const euros = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

function tempoRestante(terminaEm, agora) {
  const segundos = Math.max(0, Math.ceil((new Date(terminaEm).getTime() - agora) / 1000));
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  if (dias) return dias + ' d ' + horas + ' h ' + minutos + ' min';
  if (horas) return horas + ' h ' + minutos + ' min';
  return minutos + ' min ' + segundos % 60 + ' s';
}

function CartaoLeilao({ leilao, agora }) {
  const [imagemFalhada, setImagemFalhada] = useState(false);
  const imagem = leilao.produto?.imagemUrl;
  const propostas = leilao.numLicitacoes || 0;
  return (
    <article className="leilao-cartao">
      <Link to={'/leiloes/' + leilao._id} className="leilao-cartao__media" aria-label={'Ver leilão ' + leilao.lote}>
        {imagem && !imagemFalhada ? <img src={imagem} alt={leilao.produto?.nome || leilao.lote} loading="lazy" onError={() => setImagemFalhada(true)} /> :
          <span className="leilao-cartao__sem-imagem"><Gavel size={42} aria-hidden="true" /></span>}
        <span className="leilao-etiqueta"><span aria-hidden="true" /> Leilão ativo</span>
        {leilao.quantidade && <span className="leilao-cartao__quantidade">{leilao.quantidade}</span>}
      </Link>
      <div className="leilao-cartao__corpo">
        <h2><Link to={'/leiloes/' + leilao._id}>{leilao.lote}</Link></h2>
        {leilao.produtor?._id && <Link to={'/produtores/' + leilao.produtor._id} className="leilao-cartao__produtor">
          {leilao.produtor.produtor?.nomeExploracao || leilao.produtor.nome}
        </Link>}
        {leilao.produtor?.produtor?.localidade && <p className="leilao-cartao__localidade"><MapPin size={13} aria-hidden="true" />{leilao.produtor.produtor.localidade}</p>}
        <div className="leilao-cartao__valores">
          <div><span>{propostas ? 'Licitação atual' : 'Preço base'}</span><strong>{euros.format(leilao.licitacaoAtual?.valor ?? leilao.precoBase)}</strong></div>
          <div><span><Clock3 size={13} aria-hidden="true" /> Termina em</span><strong className="leilao-cartao__relogio">{tempoRestante(leilao.terminaEm, agora)}</strong></div>
        </div>
        <div className="leilao-cartao__rodape"><small>{propostas ? propostas + (propostas === 1 ? ' proposta' : ' propostas') : 'Sem propostas'}</small>
          <Link to={'/leiloes/' + leilao._id} className="btn btn-success">Entrar na sala <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
    </article>
  );
}

export default function Leiloes() {
  const { dados, erro, aCarregar, recarregar } = useApi('/auctions?estado=ativo');
  const [agora, setAgora] = useState(Date.now);
  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, []);
  const leiloes = (dados || []).filter(leilao => new Date(leilao.terminaEm).getTime() > agora);

  return (
    <div className="pagina-leiloes">
      <header className="pagina-cabecalho">
        <div><p className="pagina-sobretitulo">OPORTUNIDADES DA NOSSA TERRA</p><h1>Leilões</h1>
          <p>Descubra os lotes dos produtores locais e participe nos leilões ativos.</p></div>
        <button type="button" className="btn btn-outline-success leiloes-atualizar" onClick={recarregar} disabled={aCarregar}>
          <RefreshCw size={16} aria-hidden="true" /> Atualizar leilões
        </button>
      </header>
      {erro && <div className="alert alert-danger" role="alert"><p>Não foi possível carregar os leilões: {erro}</p>
        <button type="button" className="btn btn-outline-danger" onClick={recarregar} disabled={aCarregar}>Tentar novamente</button></div>}
      {aCarregar && <p className="texto-secundario" role="status">A carregar leilões…</p>}
      {!aCarregar && !erro && <>
        <div className="leiloes-resumo"><p role="status"><span aria-hidden="true" />{leiloes.length} {leiloes.length === 1 ? 'leilão ativo' : 'leilões ativos'}</p><span>Propostas em tempo real</span></div>
        {leiloes.length === 0 ? <div className="leiloes-vazio">
          <span className="leiloes-vazio__icone"><Gavel size={32} aria-hidden="true" /></span>
          <h2 className="h4">De momento não há leilões ativos</h2><p>Volte mais tarde para descobrir novos lotes dos produtores locais.</p>
          <Link to="/" className="btn btn-primary">Explorar o catálogo</Link>
        </div> : <section className="grelha-leiloes" aria-label="Leilões ativos">{leiloes.map(leilao =>
          <CartaoLeilao key={leilao._id} leilao={leilao} agora={agora} />
        )}</section>}
      </>}
    </div>
  );
}

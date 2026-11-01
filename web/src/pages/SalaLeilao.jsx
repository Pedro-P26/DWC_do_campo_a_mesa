import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Clock3, Gavel, History, MapPin, Package, ShoppingBag, Users, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useLeilao } from '../hooks/useLeilao.js';
import { useContagem, formatarTempo } from '../hooks/useContagem.js';

const euro = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

export default function SalaLeilao() {
  const { id } = useParams();
  const { utilizador } = useAuth();
  const { leilao, atual, participantes, licitacoes, offset, resultado, erro, ligado, aLicitar, licitar } = useLeilao(id);
  const [valor, setValor] = useState('');
  const [imagemFalhada, setImagemFalhada] = useState(false);
  const restante = useContagem(leilao?.estado === 'agendado' ? leilao?.iniciaEm : leilao?.terminaEm, offset);
  const minimo = Math.round(((atual?.valor ?? 0) + (leilao?.incremento ?? 0)) * 100) / 100;
  useEffect(() => { setValor(minimo ? minimo.toFixed(2) : ''); }, [minimo]);
  useEffect(() => { setImagemFalhada(false); }, [id]);
  const ativo = leilao?.estado === 'ativo' && restante > 0;
  const encerrado = leilao?.estado === 'terminado' || Boolean(resultado);
  const voltar = <Link to="/leiloes" className="ligacao-voltar"><ArrowLeft size={16} aria-hidden="true" /> Voltar aos leilões</Link>;

  if (!leilao) return <div className="pagina-sala">{voltar}<h1>Leilão</h1>
    {erro ? <p role="alert" className="alert alert-warning">{erro}</p> : <p role="status">A carregar leilão…</p>}
  </div>;

  return (
    <div className="pagina-sala">
      {voltar}
      <header className="sala-cabecalho">
        <span className="leilao-etiqueta"><span aria-hidden="true" />{ativo ? 'Leilão ativo' : leilao.estado === 'agendado' ? 'Leilão agendado' : 'Leilão terminado'}</span>
        <h1>{leilao.lote}</h1>
        <div className="sala-cabecalho__meta">
          {leilao.produtor?._id && <Link to={'/produtores/' + leilao.produtor._id}>
            {leilao.produtor.produtor?.nomeExploracao || leilao.produtor.nome}<ArrowUpRight size={15} aria-hidden="true" /></Link>}
          {leilao.produtor?.produtor?.localidade && <span><MapPin size={15} aria-hidden="true" />{leilao.produtor.produtor.localidade}</span>}
          {leilao.quantidade && <span><Package size={15} aria-hidden="true" />{leilao.quantidade}</span>}
        </div>
      </header>

      <div className="sala-leilao">
        <aside className="sala-painel" aria-label="Licitação do leilão">
          <div className="sala-painel__valor">
            <p>Licitação atual</p>
            <strong className="valor-atual" data-testid="valor-atual">{atual ? euro(atual.valor) : '—'}</strong>
            <div data-testid="contagem" className="sala-painel__contagem"><span><Clock3 size={16} aria-hidden="true" />{encerrado ? 'Leilão encerrado' : leilao.estado === 'agendado' ? 'Começa em' : 'Tempo restante'}:</span><strong>{encerrado ? 'Terminado' : formatarTempo(restante)}</strong></div>
          </div>
          <div className="sala-painel__corpo">
            <div className="sala-painel__presenca"><p><Users size={16} aria-hidden="true" />{participantes} a assistir</p>
              <p role="status" className={ligado ? '' : 'sala-painel__desligado'}>{ligado ? <Wifi size={15} aria-hidden="true" /> : <WifiOff size={15} aria-hidden="true" />}{ligado ? 'Ligação ativa' : 'A restabelecer ligação…'}</p>
            </div>
            {ativo && atual?.comprador === (utilizador?.id || utilizador?._id) && <p className="sala-painel__lider">É a licitação mais alta.</p>}
            {resultado && <div className="sala-painel__resultado" role="status">
              Leilão terminado. {resultado.vencedor ? 'Vencedor: ' + resultado.vencedor.nome + ' · ' + euro(resultado.valor) : 'Sem licitações.'}
              {resultado.vencedor?.id === (utilizador?.id || utilizador?._id) && <p><Link to="/encomendas">Ver encomenda do leilão</Link></p>}
            </div>}
            {ativo && utilizador?.papel === 'comprador' && <form onSubmit={e => { e.preventDefault(); licitar(Number(valor)); }}>
              <label htmlFor="valor" className="form-label">O seu valor (mínimo {euro(minimo)})</label>
              <div className="sala-painel__campo"><input id="valor" type="number" step="0.01" min={minimo} className="form-control" value={valor} onChange={e => setValor(e.target.value)} required disabled={!ligado || aLicitar} /><span aria-hidden="true">€</span></div>
              <div className="sala-painel__incrementos">{[1, 2, 5].map(k =>
                <button key={k} type="button" disabled={!ligado || aLicitar} onClick={() => setValor((Math.round((atual.valor + k * leilao.incremento) * 100) / 100).toFixed(2))}>+{euro(k * leilao.incremento)}</button>
              )}</div>
              <button type="submit" className="btn btn-success sala-painel__licitar" disabled={!ligado || aLicitar}><Gavel size={18} aria-hidden="true" />{aLicitar ? 'A licitar…' : 'Licitar'}</button>
            </form>}
            {ativo && utilizador?.papel !== 'comprador' && <p className="sala-painel__observador">Está a acompanhar este leilão. As propostas são feitas por compradores.</p>}
            {erro && <div className="alert alert-warning mt-3 mb-0" role="alert">{erro}</div>}
            <p className="sala-painel__estado">Estado: {leilao.estado}</p>
          </div>
        </aside>

        <div className="sala-lote">
          <section className="sala-lote__apresentacao" aria-label="Detalhes do lote">
            {leilao.produto?.imagemUrl && !imagemFalhada ? <img className="sala-lote__imagem" src={leilao.produto.imagemUrl} alt={leilao.lote} onError={() => setImagemFalhada(true)} /> :
              <div className="sala-lote__sem-imagem"><Package size={42} aria-hidden="true" /><span>Fotografia indisponível</span></div>}
            <div className="sala-lote__descricao"><p className="pagina-sobretitulo">SOBRE ESTE LOTE</p><h2>Da exploração para si</h2>
              <p>{leilao.descricao || 'O produtor não adicionou uma descrição a este lote.'}</p>
              <dl><div><dt>Preço base</dt><dd>{euro(leilao.precoBase)}</dd></div><div><dt>Incremento mínimo</dt><dd>{euro(leilao.incremento)}</dd></div>{leilao.quantidade && <div><dt>Quantidade</dt><dd>{leilao.quantidade}</dd></div>}</dl>
            </div>
          </section>

          <section className="sala-historico" aria-labelledby="titulo-historico">
            <div className="sala-historico__cabecalho"><div><History size={20} aria-hidden="true" /><h2 id="titulo-historico">Histórico de licitações</h2></div><span>{leilao.numLicitacoes || licitacoes.length} propostas</span></div>
            {!licitacoes.length && <div className="sala-historico__vazio"><ShoppingBag size={28} aria-hidden="true" /><p>Ainda sem licitações.</p><span>As propostas vão aparecer aqui em tempo real.</span></div>}
            <ol>{licitacoes.map((b, indice) => <li key={b._id}>
              <span className="sala-historico__avatar" aria-hidden="true">{(b.nome || 'Comprador').charAt(0)}</span>
              <div><strong>{b.nome || 'Comprador'}</strong><time dateTime={b.createdAt}>{new Date(b.createdAt).toLocaleTimeString('pt-PT')}</time></div>
              <div className="sala-historico__proposta"><strong>{euro(b.valor)}</strong>{indice === 0 && <span>Mais recente</span>}</div>
            </li>)}</ol>
          </section>
        </div>
      </div>
    </div>
  );
}

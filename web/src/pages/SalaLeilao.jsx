import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLeilao } from '../hooks/useLeilao.js';
import { useContagem, formatarTempo } from '../hooks/useContagem.js';
const euro = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
export default function SalaLeilao() {
  const { id } = useParams(); const { utilizador } = useAuth();
  const { leilao, atual, participantes, licitacoes, offset, resultado, erro, ligado, aLicitar, licitar } = useLeilao(id);
  const [valor, setValor] = useState('');
  const restante = useContagem(leilao?.estado === 'agendado' ? leilao?.iniciaEm : leilao?.terminaEm, offset);
  const minimo = Math.round(((atual?.valor ?? 0) + (leilao?.incremento ?? 0)) * 100) / 100;
  useEffect(() => { setValor(minimo ? minimo.toFixed(2) : ''); }, [minimo]);
  const ativo = leilao?.estado === 'ativo' && restante > 0;
  return <div className="sala-leilao">
    <section>
      <h1>{leilao?.lote || 'Leilão'}</h1>
      {!leilao && !erro && <p role="status">A carregar leilão…</p>}
      {leilao?.produto?.imagemUrl && <img className="img-fluid rounded mb-3" src={leilao.produto.imagemUrl} alt={leilao.lote} />}
      <p>{leilao?.descricao}</p><p>{leilao?.quantidade}</p>
      {leilao?.produtor && <p>Produtor: {leilao.produtor.nome} · {leilao.produtor.produtor?.localidade}</p>}
      <h2>Histórico de licitações</h2>
      {!licitacoes.length && <p>Ainda sem licitações.</p>}
      <ol>{licitacoes.map(b => <li key={b._id}>{b.nome || 'Comprador'} · {euro(b.valor)} · {new Date(b.createdAt).toLocaleTimeString('pt-PT')}</li>)}</ol>
    </section>
    <aside className="card p-3">
      <p>{participantes} a assistir</p>
      <p role="status">{ligado ? 'Ligação ativa' : 'A restabelecer ligação…'}</p>
      {leilao && <p data-testid="contagem">{leilao.estado === 'agendado' ? 'Começa em' : 'Tempo restante'}: {formatarTempo(restante)}</p>}
      <p>Estado: {leilao?.estado || 'a carregar'}</p>
      <p className="mb-0">Licitação atual</p>
      <p className="valor-atual" data-testid="valor-atual">{atual ? euro(atual.valor) : '—'}</p>
      {ativo && atual?.comprador === utilizador?.id && <p>É a licitação mais alta.</p>}
      {resultado && <div className="alert alert-info" role="status">
        Leilão terminado. {resultado.vencedor ? `Vencedor: ${resultado.vencedor.nome} · ${euro(resultado.valor)}` : 'Sem licitações.'}
        {resultado.vencedor?.id === utilizador?.id && <p><Link to="/encomendas">Ver encomenda do leilão</Link></p>}
      </div>}
      {ativo && utilizador?.papel === 'comprador' && <form onSubmit={e => { e.preventDefault(); licitar(Number(valor)); }}>
        <div className="d-flex gap-2 mb-2">{[1, 2, 5].map(k => <button key={k} type="button" disabled={!ligado || aLicitar} className="btn btn-outline-secondary" onClick={() => setValor((Math.round((atual.valor + k * leilao.incremento) * 100) / 100).toFixed(2))}>+{euro(k * leilao.incremento)}</button>)}</div>
        <label htmlFor="valor" className="form-label">O seu valor (mínimo {euro(minimo)})</label>
        <input id="valor" type="number" step="0.01" min={minimo} className="form-control mb-2" value={valor} onChange={e => setValor(e.target.value)} required disabled={!ligado || aLicitar} />
        <button type="submit" className="btn btn-success w-100" disabled={!ligado || aLicitar}>{aLicitar ? 'A licitar…' : 'Licitar'}</button>
      </form>}
      {erro && <div className="alert alert-warning mt-2" role="alert">{erro}</div>}
    </aside>
  </div>;
}

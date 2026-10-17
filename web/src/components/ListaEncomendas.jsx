import { useCallback, useState } from 'react';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useEventoSocket } from '../context/SocketContext.jsx';
import { api } from '../api/client.js';
import EstadoEncomenda from './EstadoEncomenda.jsx';
import { ArrowRight, CheckCircle2, LoaderCircle } from 'lucide-react';
const estados = ['pendente', 'confirmada', 'pronta', 'entregue'];
const rotulos = { pendente: 'Pendente', confirmada: 'Confirmada', pronta: 'Pronta', entregue: 'Entregue' };
const acoes = { pendente: 'Confirmar encomenda', confirmada: 'Marcar como pronta', pronta: 'Confirmar entrega' };
const euro = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
function orientacao(o) {
  if (o.estado === 'pendente') return 'Confirme o pedido para iniciar a preparação.';
  if (o.estado === 'confirmada') return 'Quando terminar a preparação, marque o pedido como pronto.';
  if (o.estado === 'pronta') return o.entrega?.tipo === 'entrega'
    ? 'Confirme quando a encomenda chegar ao comprador.' : 'Confirme quando o comprador levantar a encomenda.';
  return 'Todos os passos desta encomenda estão concluídos.';
}
export default function ListaEncomendas({ produtor = false, fonte }) {
  const interna = useApi(fonte ? null : '/orders');
  const { dados, erro, aCarregar, recarregar, setDados } = fonte || interna;
  const { token } = useAuth(); const [falha, setFalha] = useState(''); const [ocupada, setOcupada] = useState(null);
  const atualizar = useCallback(e => setDados(ls => ls?.map(o => o._id === e.id ? { ...o, estado: e.estado } : o)), [setDados]);
  useEventoSocket('encomenda-atualizada', atualizar);
  useEventoSocket('nova-encomenda', recarregar);
  useEventoSocket('leilao-ganho', recarregar);
  useEventoSocket('leilao-terminado', recarregar);
  useEventoSocket('connect', recarregar);
  async function avancar(o) {
    setOcupada(o._id); setFalha('');
    try { const nova = await api(`/orders/${o._id}/estado`, { metodo: 'PATCH', token, corpo: { estado: estados[estados.indexOf(o.estado) + 1] } }); atualizar({ id: nova._id, estado: nova.estado }); }
    catch (err) { setFalha(err.message); } finally { setOcupada(null); }
  }
  async function avaliar(e, o) {
    e.preventDefault(); const form = e.currentTarget; const valores = new FormData(form); setOcupada(o._id); setFalha('');
    try { await api('/reviews', { metodo: 'POST', token, corpo: { encomenda: o._id, classificacao: Number(valores.get('nota')), comentario: valores.get('comentario') } }); form.reset(); setFalha('Avaliação enviada.'); }
    catch (err) { setFalha(err.message); } finally { setOcupada(null); }
  }
  return <>
    <button className="btn btn-outline-success mb-3" onClick={recarregar} disabled={aCarregar}>Atualizar encomendas</button>
    {(erro || falha) && <p role="alert" className="alert alert-info">{erro || falha}</p>}
    {aCarregar && !dados && <p role="status">A carregar encomendas…</p>}
    {dados?.length === 0 && <p>Ainda sem encomendas.</p>}
    {dados?.map(o => <article className="card encomenda mb-3" key={o._id} data-testid={`encomenda-${o._id}`}>
      <div className="encomenda__cabecalho">
        <div><h3 className="encomenda__titulo">Encomenda #{o._id.slice(-6)}</h3>
          <p className="encomenda__pessoa">{produtor ? o.comprador?.nome : o.produtor?.nome}</p></div>
        <span className={`encomenda__estado encomenda__estado--${o.estado}`}>{rotulos[o.estado]}</span>
      </div>
      <ul className="encomenda__produtos">{o.linhas.map((l, i) => <li key={i}>{l.nome} · {l.quantidade} {l.unidade} · {euro(l.precoUnit)}</li>)}</ul>
      <p className="encomenda__total">Total: <strong>{euro(o.total)}</strong><span>{o.origem === 'leilao' ? 'Leilão' : 'Loja'} · {o.entrega?.tipo === 'entrega' ? 'Entrega' : 'Levantamento'}</span></p>
      <EstadoEncomenda estado={o.estado} />
      {produtor && <div className="encomenda__rodape">
        <div className="encomenda__orientacao">
          <span className="encomenda__proximo">{o.estado === 'entregue' ? <><CheckCircle2 size={16} aria-hidden="true" /> Encomenda concluída</> : 'Próximo passo'}</span>
          <p id={`proximo-${o._id}`}>{orientacao(o)}</p>
        </div>
        {o.estado !== 'entregue' && <button type="button" className="btn btn-success encomenda__avancar"
          aria-describedby={`proximo-${o._id}`} aria-busy={ocupada === o._id}
          disabled={ocupada === o._id} onClick={() => avancar(o)}>
          {ocupada === o._id ? <><LoaderCircle size={17} className="encomenda__a-atualizar" aria-hidden="true" /> A atualizar…</>
            : <>{acoes[o.estado]}<ArrowRight size={17} aria-hidden="true" /></>}
        </button>}
      </div>}
      {!produtor && o.estado === 'entregue' && <form className="encomenda__avaliacao" onSubmit={e => avaliar(e, o)}>
        <label htmlFor={`nota-${o._id}`}>Classificação</label><select id={`nota-${o._id}`} className="form-select mb-2" name="nota">{[5, 4, 3, 2, 1].map(n => <option key={n}>{n}</option>)}</select>
        <label htmlFor={`comentario-${o._id}`}>Comentário</label><textarea id={`comentario-${o._id}`} name="comentario" maxLength={1000} className="form-control mb-2" />
        <button className="btn btn-outline-success" disabled={ocupada === o._id}>Enviar avaliação</button>
      </form>}
    </article>)}
  </>;
}

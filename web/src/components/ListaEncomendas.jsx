import { useCallback, useState } from 'react';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useEventoSocket } from '../context/SocketContext.jsx';
import { api } from '../api/client.js';
import EstadoEncomenda from './EstadoEncomenda.jsx';
const estados = ['pendente', 'confirmada', 'pronta', 'entregue'];
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
    {dados?.map(o => <article className="card p-3 mb-3" key={o._id} data-testid={`encomenda-${o._id}`}>
      <h3 className="h5">Encomenda #{o._id.slice(-6)} · {produtor ? o.comprador?.nome : o.produtor?.nome}</h3>
      <ul>{o.linhas.map((l, i) => <li key={i}>{l.nome} · {l.quantidade} {l.unidade} · {l.precoUnit.toFixed(2)} €</li>)}</ul>
      <p>Total: {o.total.toFixed(2)} € · {o.origem === 'leilao' ? 'Leilão' : 'Loja'}</p>
      <EstadoEncomenda estado={o.estado} />
      {produtor && o.estado !== 'entregue' && <button className="btn btn-success" disabled={ocupada === o._id} onClick={() => avancar(o)}>Marcar como {estados[estados.indexOf(o.estado) + 1]}</button>}
      {!produtor && o.estado === 'entregue' && <form onSubmit={e => avaliar(e, o)}>
        <label htmlFor={`nota-${o._id}`}>Classificação</label><select id={`nota-${o._id}`} className="form-select mb-2" name="nota">{[5, 4, 3, 2, 1].map(n => <option key={n}>{n}</option>)}</select>
        <label htmlFor={`comentario-${o._id}`}>Comentário</label><textarea id={`comentario-${o._id}`} name="comentario" maxLength={1000} className="form-control mb-2" />
        <button className="btn btn-outline-success" disabled={ocupada === o._id}>Enviar avaliação</button>
      </form>}
    </article>)}
  </>;
}

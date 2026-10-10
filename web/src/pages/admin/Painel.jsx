// Administrador: validação de produtores, moderação e estatísticas
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';

function Estado({ consulta, vazio }) {
  if (consulta.erro) return <p role="alert" className="alert alert-danger">{consulta.erro}</p>;
  if (consulta.aCarregar) return <p role="status">A carregar…</p>;
  return consulta.dados?.length === 0 ? <p>{vazio}</p> : null;
}

export default function PainelAdmin() {
  const estatisticas = useApi('/admin/estatisticas');
  const produtores = useApi('/admin/produtores/pendentes');
  const reviews = useApi('/admin/reviews/denunciadas');
  const leiloes = useApi('/auctions?estado=ativo');
  const { token } = useAuth();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const pedido = useRef(false);
  async function atualizar() {
    await Promise.all([estatisticas.recarregar(), produtores.recarregar(), reviews.recarregar(), leiloes.recarregar()]);
  }
  async function alterar(caminho, corpo, sucesso) {
    if (pedido.current) return;
    pedido.current = true;
    setOcupado(true);
    setErro('');
    setMensagem('');
    try {
      await api(caminho, { metodo: 'PATCH', token, corpo });
      setMensagem(sucesso);
      await atualizar();
    } catch (err) { setErro(err.message); }
    finally { pedido.current = false; setOcupado(false); }
  }
  const indicadores = { utilizadores: 'Utilizadores', produtores: 'Produtores', encomendasHoje: 'Encomendas de hoje', leiloesAtivos: 'Leilões ativos' };
  return <>
    <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
      <h1>Administração</h1>
      <button className="btn btn-outline-primary" disabled={ocupado || [estatisticas, produtores, reviews, leiloes].some(c => c.aCarregar)} onClick={atualizar}>Atualizar painel</button>
    </div>
    {erro && <p role="alert" className="alert alert-danger">{erro}</p>}
    {mensagem && <p role="status" className="alert alert-success">{mensagem}</p>}
    <section aria-labelledby="estatisticas-admin" className="mb-4">
      <h2 id="estatisticas-admin">Estatísticas</h2><Estado consulta={estatisticas} />
      {estatisticas.dados && <dl className="row g-3">{Object.entries(indicadores).map(([campo, rotulo]) =>
        <div className="col-6 col-lg-3" key={campo}><div className="card h-100 p-3"><dt>{rotulo}</dt><dd className="fs-3 mb-0">{estatisticas.dados[campo]}</dd></div></div>)}</dl>}
    </section>
    <section aria-labelledby="produtores-admin" className="mb-4">
      <h2 id="produtores-admin">Produtores por validar</h2><Estado consulta={produtores} vazio="Não há produtores por validar." />
      <div className="row g-3">{produtores.dados?.map(p => <div key={p._id} className="col-12 col-lg-6"><article className="card h-100 p-3">
        <h3 className="h5">{p.nome}</h3><p>{p.email}<br />{p.produtor?.nomeExploracao} · {p.produtor?.localidade}</p>
        <button className="btn btn-primary align-self-start" disabled={ocupado} onClick={() => alterar(`/admin/produtores/${p._id}/validacao`, { aprovado: true }, 'Produtor aprovado.')}>Aprovar produtor</button>
      </article></div>)}</div>
    </section>
    <section aria-labelledby="reviews-admin" className="mb-4">
      <h2 id="reviews-admin">Avaliações denunciadas</h2><Estado consulta={reviews} vazio="Não há avaliações denunciadas." />
      <div className="row g-3">{reviews.dados?.map(r => <div key={r._id} className="col-12 col-lg-6"><article className="card h-100 p-3">
        <h3 className="h5">{r.autor?.nome || 'Utilizador'} → {r.produtor?.nome || 'Produtor'}</h3>
        <p>{r.classificacao}/5 · {r.denuncias} denúncias · {r.visivel ? 'Visível' : 'Oculta'}</p><p>{r.comentario}</p>
        <button className="btn btn-outline-primary align-self-start" disabled={ocupado} onClick={() => alterar(`/admin/reviews/${r._id}`, { visivel: !r.visivel }, r.visivel ? 'Avaliação ocultada.' : 'Avaliação reposta.')}>
          {r.visivel ? 'Ocultar avaliação' : 'Repor avaliação'}
        </button>
      </article></div>)}</div>
    </section>
    <section aria-labelledby="leiloes-admin">
      <h2 id="leiloes-admin">Leilões ativos</h2><Estado consulta={leiloes} vazio="Não há leilões ativos." />
      <div className="row g-3">{leiloes.dados?.map(l => <div key={l._id} className="col-12 col-lg-6"><article className="card h-100 p-3">
        <h3 className="h5">{l.lote}</h3><p>Licitação atual: {Number(l.licitacaoAtual?.valor ?? l.precoBase).toFixed(2)} €<br />Termina: {new Date(l.terminaEm).toLocaleString('pt-PT')}</p>
        <Link to={`/leiloes/${l._id}`}>Abrir sala do leilão</Link>
      </article></div>)}</div>
    </section>
  </>;
}

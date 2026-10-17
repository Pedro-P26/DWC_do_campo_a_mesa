// Administrador: validação de produtores, moderação e estatísticas
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';

const euro = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
const data = (valor, comHora = false) => new Date(valor).toLocaleString('pt-PT', {
  timeZone: 'Europe/Lisbon', dateStyle: 'short', ...(comHora ? { timeStyle: 'short' } : {})
});

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
  const resumo = estatisticas.dados;
  const indicadores = resumo ? [
    { campo: 'utilizadores', rotulo: 'Utilizadores', detalhe: `+${resumo.utilizadoresSemana} nos últimos 7 dias` },
    { campo: 'produtores', rotulo: 'Produtores ativos', detalhe: `${resumo.produtoresPendentes} por validar` },
    { campo: 'encomendasHoje', rotulo: 'Encomendas hoje', detalhe: euro(resumo.valorEncomendasHoje) },
    { campo: 'leiloesAtivos', rotulo: 'Leilões em direto', detalhe: `${resumo.produtoresPendentes} ${resumo.produtoresPendentes === 1 ? 'validação pendente' : 'validações pendentes'}` }
  ] : [];
  return <div className="painel-admin">
    <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
      <h1>Administração</h1>
      <button className="btn btn-outline-primary" disabled={ocupado || [estatisticas, produtores, reviews, leiloes].some(c => c.aCarregar)} onClick={atualizar}>Atualizar painel</button>
    </div>
    {erro && <p role="alert" className="alert alert-danger">{erro}</p>}
    {mensagem && <p role="status" className="alert alert-success">{mensagem}</p>}
    <section aria-labelledby="estatisticas-admin" className="mb-4">
      <h2 id="estatisticas-admin" className="visually-hidden">Estatísticas</h2><Estado consulta={estatisticas} />
      {resumo && <dl className="row g-3 mb-0">{indicadores.map(({ campo, rotulo, detalhe }) =>
        <div className="col-6 col-lg-3" key={campo}><div className="painel-admin__indicador h-100">
          <dt>{rotulo}</dt><dd className="mb-0"><span className="painel-admin__valor" data-testid={campo}>{resumo[campo]}</span>
            <small>{detalhe}</small></dd>
        </div></div>)}</dl>}
    </section>
    <div className="painel-admin__grelha">
    <div className="painel-admin__moderacao">
    <section aria-labelledby="produtores-admin" className="painel-admin__secao">
      <h2 id="produtores-admin">Produtores por validar</h2><Estado consulta={produtores} vazio="Não há produtores por validar." />
      {produtores.dados?.map(p => <article key={p._id} className="painel-admin__item painel-admin__linha">
        <div>
          <h3>{p.produtor?.nomeExploracao || p.nome}</h3>
          <p className="painel-admin__metadados">{p.nome} · {p.email}{p.produtor?.localidade && ` · ${p.produtor.localidade}`}
            {p.createdAt && <> · Registado em <time dateTime={p.createdAt}>{data(p.createdAt)}</time></>}</p>
          {p.produtor?.descricao && <p>{p.produtor.descricao}</p>}
        </div>
        <div className="painel-admin__acoes">
          <button className="btn btn-sm btn-outline-danger" disabled={ocupado} aria-label={`Rejeitar produtor ${p.nome}`}
            onClick={() => alterar(`/admin/produtores/${p._id}/validacao`, { aprovado: false }, 'Produtor rejeitado.')}>Rejeitar produtor</button>
          <button className="btn btn-sm btn-primary" disabled={ocupado} aria-label={`Aprovar produtor ${p.nome}`}
            onClick={() => alterar(`/admin/produtores/${p._id}/validacao`, { aprovado: true }, 'Produtor aprovado.')}>Aprovar produtor</button>
        </div>
      </article>)}
    </section>
    <section aria-labelledby="reviews-admin" className="painel-admin__secao">
      <h2 id="reviews-admin">Avaliações denunciadas</h2><Estado consulta={reviews} vazio="Não há avaliações denunciadas." />
      {reviews.dados?.map(r => <article key={r._id} className="painel-admin__item painel-admin__linha">
        <div>
          <h3>{r.autor?.nome || 'Utilizador'} → {r.produtor?.nome || 'Produtor'}</h3>
          <p>{r.comentario}</p>
          <p className="painel-admin__metadados">{r.classificacao}/5 · {r.denuncias} {r.denuncias === 1 ? 'denúncia' : 'denúncias'} · {r.visivel ? 'Visível' : 'Oculta'}</p>
        </div>
        <div className="painel-admin__acoes">
          {r.visivel && <button className="btn btn-sm btn-outline-secondary" disabled={ocupado}
            onClick={() => alterar(`/admin/reviews/${r._id}`, { visivel: true, resolverDenuncias: true }, 'Avaliação mantida. Denúncias resolvidas.')}>Manter avaliação</button>}
          <button className={`btn btn-sm ${r.visivel ? 'btn-danger' : 'btn-outline-primary'}`} disabled={ocupado}
            onClick={() => alterar(`/admin/reviews/${r._id}`, { visivel: !r.visivel }, r.visivel ? 'Avaliação ocultada.' : 'Avaliação reposta.')}>
            {r.visivel ? 'Ocultar avaliação' : 'Repor avaliação'}
          </button>
        </div>
      </article>)}
    </section>
    </div>
    <section aria-labelledby="leiloes-admin" className="painel-admin__secao">
      <h2 id="leiloes-admin">Leilões ativos</h2><Estado consulta={leiloes} vazio="Não há leilões ativos." />
      {leiloes.dados?.map(l => <article key={l._id} className="painel-admin__item">
        <h3><Link to={`/leiloes/${l._id}`}>{l.lote}</Link></h3>
        <p className="painel-admin__metadados">{l.produtor?.produtor?.nomeExploracao || l.produtor?.nome || 'Produtor indisponível'} · {euro(l.licitacaoAtual?.valor ?? l.precoBase)} · {l.numLicitacoes ?? 0} {(l.numLicitacoes ?? 0) === 1 ? 'licitação' : 'licitações'}<br />
          Termina: <time dateTime={l.terminaEm}>{data(l.terminaEm, true)}</time></p>
        <Link to={`/leiloes/${l._id}`}>Abrir sala do leilão</Link>
      </article>)}
    </section>
    </div>
  </div>;
}

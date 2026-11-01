// Administrador: validação de produtores, moderação e estatísticas
import { useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, EyeOff, Flag, Gavel, RefreshCw, ShieldCheck, ShoppingBag, Sprout, Star, Users, X } from 'lucide-react';
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
  return consulta.dados?.total === 0 ? <p className="painel-admin__vazio">{vazio}</p> : null;
}


function useLista(caminho) {
  const [pagina, setPagina] = useState(1);
  const consulta = useApi(caminho + (caminho.includes('?') ? '&' : '?') + 'pagina=' + pagina + '&limite=5');
  return { ...consulta, setPagina, itens: !consulta.aCarregar && !consulta.erro ? consulta.dados?.dados || [] : [] };
}

function Paginacao({ consulta, nome }) {
  const resposta = consulta.dados;
  if (!resposta?.total || consulta.erro) return null;
  const { pagina, limite, total, totalPaginas } = resposta;
  const inicio = (pagina - 1) * limite + 1;
  function mudarPagina(evento, numero) {
    consulta.setPagina(numero);
    evento.currentTarget.closest('section')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start'
    });
  }
  return <div className="admin-paginacao">
    <p role="status">A mostrar {inicio}–{Math.min(pagina * limite, total)} de {total}</p>
    {totalPaginas > 1 && <nav aria-label={'Paginação: ' + nome}>
      <button type="button" disabled={consulta.aCarregar || pagina === 1} onClick={evento => mudarPagina(evento, pagina - 1)} aria-label="Página anterior">
        <ChevronLeft size={17} aria-hidden="true" /><span>Anterior</span>
      </button>
      <span aria-live="polite">Página {pagina} de {totalPaginas}</span>
      <button type="button" disabled={consulta.aCarregar || pagina === totalPaginas} onClick={evento => mudarPagina(evento, pagina + 1)} aria-label="Página seguinte">
        <span>Seguinte</span><ChevronRight size={17} aria-hidden="true" />
      </button>
    </nav>}
  </div>;
}

function TituloSecao({ id, icone: Icone, titulo, consulta }) {
  return <div className="painel-admin__titulo-secao"><div><Icone size={20} aria-hidden="true" /><h2 id={id}>{titulo}</h2></div>
    {consulta.dados && !consulta.erro && <span className="painel-admin__total">{consulta.dados.total}</span>}
  </div>;
}

export default function PainelAdmin() {
  const estatisticas = useApi('/admin/estatisticas');
  const produtores = useLista('/admin/produtores/pendentes');
  const reviews = useLista('/admin/reviews/denunciadas');
  const leiloes = useLista('/auctions?estado=ativo');
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
    { campo: 'utilizadores', rotulo: 'Utilizadores', icone: Users, detalhe: `+${resumo.utilizadoresSemana} nos últimos 7 dias` },
    { campo: 'produtores', rotulo: 'Produtores ativos', icone: Sprout, detalhe: `${resumo.produtoresPendentes} por validar` },
    { campo: 'encomendasHoje', rotulo: 'Encomendas hoje', icone: ShoppingBag, detalhe: euro(resumo.valorEncomendasHoje) },
    { campo: 'leiloesAtivos', rotulo: 'Leilões em direto', icone: Gavel, detalhe: 'Acompanhe as propostas nas salas' }
  ] : [];
  return <div className="painel-admin">
    <header className="pagina-cabecalho">
      <div><p className="pagina-sobretitulo">GESTÃO DA COMUNIDADE</p><h1>Administração</h1>
        <p>Valide produtores, acompanhe os leilões e cuide da comunidade.</p></div>
      <button className="btn btn-outline-success painel-admin__atualizar" disabled={ocupado || [estatisticas, produtores, reviews, leiloes].some(c => c.aCarregar)} onClick={atualizar}>
        <RefreshCw size={16} aria-hidden="true" /> Atualizar painel</button>
    </header>
    {erro && <p role="alert" className="alert alert-danger">{erro}</p>}
    {mensagem && <p role="status" className="alert alert-success">{mensagem}</p>}
    <section aria-labelledby="estatisticas-admin" className="mb-4">
      <h2 id="estatisticas-admin" className="visually-hidden">Estatísticas</h2><Estado consulta={estatisticas} />
      {resumo && <dl className="painel-admin__indicadores">{indicadores.map(({ campo, rotulo, detalhe, icone: Icone }) =>
        <div className="painel-admin__indicador" key={campo}>
          <dt><Icone size={18} aria-hidden="true" />{rotulo}</dt><dd className="mb-0"><span className="painel-admin__valor" data-testid={campo}>{resumo[campo]}</span>
            <small>{detalhe}</small></dd>
        </div>)}</dl>}
    </section>
    <div className="painel-admin__grelha">
    <div className="painel-admin__moderacao">
    <section aria-labelledby="produtores-admin" className="painel-admin__secao">
      <TituloSecao id="produtores-admin" icone={ShieldCheck} titulo="Produtores por validar" consulta={produtores} /><Estado consulta={produtores} vazio="Não há produtores por validar." />
      {produtores.itens.map(p => <article key={p._id} className="painel-admin__item painel-admin__linha">
        <div>
          <h3>{p.produtor?.nomeExploracao || p.nome}</h3>
          <p className="painel-admin__metadados">{p.nome} · {p.email}{p.produtor?.localidade && ` · ${p.produtor.localidade}`}
            {p.createdAt && <> · Registado em <time dateTime={p.createdAt}>{data(p.createdAt)}</time></>}</p>
          {p.produtor?.descricao && <p>{p.produtor.descricao}</p>}
        </div>
        <div className="painel-admin__acoes">
          <button className="btn btn-sm btn-outline-danger" disabled={ocupado} aria-label={`Rejeitar produtor ${p.nome}`}
            onClick={() => alterar(`/admin/produtores/${p._id}/validacao`, { aprovado: false }, 'Produtor rejeitado.')}><X size={15} aria-hidden="true" /> Rejeitar produtor</button>
          <button className="btn btn-sm btn-primary" disabled={ocupado} aria-label={`Aprovar produtor ${p.nome}`}
            onClick={() => alterar(`/admin/produtores/${p._id}/validacao`, { aprovado: true }, 'Produtor aprovado.')}><Check size={15} aria-hidden="true" /> Aprovar produtor</button>
        </div>
      </article>)}
      <Paginacao consulta={produtores} nome="Produtores por validar" />
    </section>
    <section aria-labelledby="reviews-admin" className="painel-admin__secao">
      <TituloSecao id="reviews-admin" icone={Flag} titulo="Avaliações denunciadas" consulta={reviews} /><Estado consulta={reviews} vazio="Não há avaliações denunciadas." />
      {reviews.itens.map(r => <article key={r._id} className="painel-admin__item painel-admin__linha">
        <div>
          <h3>{r.autor?.nome || 'Utilizador'} → {r.produtor?.nome || 'Produtor'}</h3>
          <p className="painel-admin__comentario">{r.comentario}</p>
          <div className="painel-admin__etiquetas"><span className="painel-admin__classificacao"><Star size={13} fill="currentColor" aria-hidden="true" />{r.classificacao}/5</span><span className="painel-admin__denuncias">{r.denuncias} {r.denuncias === 1 ? 'denúncia' : 'denúncias'}</span><span>{r.visivel ? 'Visível' : 'Oculta'}</span></div>
        </div>
        <div className="painel-admin__acoes">
          {r.visivel && <button className="btn btn-sm btn-outline-secondary" disabled={ocupado}
            onClick={() => alterar(`/admin/reviews/${r._id}`, { visivel: true, resolverDenuncias: true }, 'Avaliação mantida. Denúncias resolvidas.')}><Check size={15} aria-hidden="true" /> Manter avaliação</button>}
          <button className={`btn btn-sm ${r.visivel ? 'btn-danger' : 'btn-outline-primary'}`} disabled={ocupado}
            onClick={() => alterar(`/admin/reviews/${r._id}`, { visivel: !r.visivel }, r.visivel ? 'Avaliação ocultada.' : 'Avaliação reposta.')}>
            <EyeOff size={15} aria-hidden="true" />{r.visivel ? 'Ocultar avaliação' : 'Repor avaliação'}
          </button>
        </div>
      </article>)}
      <Paginacao consulta={reviews} nome="Avaliações denunciadas" />
    </section>
    </div>
    <section aria-labelledby="leiloes-admin" className="painel-admin__secao">
      <TituloSecao id="leiloes-admin" icone={Gavel} titulo="Leilões ativos" consulta={leiloes} /><Estado consulta={leiloes} vazio="Não há leilões ativos." />
      {leiloes.itens.map(l => <article key={l._id} className="painel-admin__item">
        <h3><Link to={`/leiloes/${l._id}`}>{l.lote}</Link></h3>
        <p className="painel-admin__metadados">{l.produtor?.produtor?.nomeExploracao || l.produtor?.nome || 'Produtor indisponível'} · {euro(l.licitacaoAtual?.valor ?? l.precoBase)} · {l.numLicitacoes ?? 0} {(l.numLicitacoes ?? 0) === 1 ? 'licitação' : 'licitações'}<br />
          Termina: <time dateTime={l.terminaEm}>{data(l.terminaEm, true)}</time></p>
        <Link className="painel-admin__abrir-sala" to={`/leiloes/${l._id}`}>Abrir sala do leilão <ArrowRight size={15} aria-hidden="true" /></Link>
      </article>)}
      <Paginacao consulta={leiloes} nome="Leilões ativos" />
    </section>
    </div>
  </div>;
}

// Visitante: catálogo com pesquisa e filtros
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import CartaoProduto from '../components/CartaoProduto.jsx';
import LeilaoDestaque from '../components/LeilaoDestaque.jsx';
import { useApi } from '../hooks/useApi.js';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';
import produtosSimulados from '../data/produtos.json';

const CATEGORIAS = ['Todos', 'Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria', 'Outros'];
const FILTRO_INICIAL = { q: '', categoria: 'Todos', epoca: 'Todas', modoBio: 'Todos', precoMax: '', produtor: '', localidade: '' };
const PRODUTOS_POR_PAGINA = 12;
const EPOCAS = ['Todas', 'Primavera', 'Verão', 'Outono', 'Inverno'];
const MODOS_BIO = [
  { valor: 'Todos', rotulo: 'Todos' },
  { valor: 'Biologico', rotulo: 'Biológico' },
  { valor: 'Convencional', rotulo: 'Convencional' }
];
const ORDENACOES = [
  { valor: 'original', rotulo: 'Ordem original' },
  { valor: 'preco-asc', rotulo: 'Preço crescente' },
  { valor: 'preco-desc', rotulo: 'Preço decrescente' },
  { valor: 'nome-asc', rotulo: 'Nome: A a Z' },
  { valor: 'nome-desc', rotulo: 'Nome: Z a A' }
];

export default function Catalogo() {
  const [produtos, setProdutos] = useState([]);
  const [filtro, setFiltro] = useState(FILTRO_INICIAL);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [pagina, setPagina] = useState(1);
  const inicioResultados = useRef(null);
  const consultaProdutores = useApi(USAR_DADOS_SIMULADOS ? null : '/producers');
  const produtores = USAR_DADOS_SIMULADOS ? [...new Map(produtosSimulados.map(p => [p.produtor._id, p.produtor])).values()] : consultaProdutores.dados || [];
  const [ordenacao, setOrdenacao] = useState('original');
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(!USAR_DADOS_SIMULADOS);
  const carrinho = useCarrinho();
  const { utilizador } = useAuth();

  useEffect(() => {
    if (filtro.precoMax !== '' && (!Number.isFinite(Number(filtro.precoMax)) || Number(filtro.precoMax) < 0)) {
      setErro('O preço máximo deve ser um número igual ou superior a zero.');
      setACarregar(false);
      return;
    }
    if (USAR_DADOS_SIMULADOS) {
      // Semana 2: filtragem local sobre dados simulados
      setProdutos(produtosSimulados.filter((p) =>
        (filtro.categoria === 'Todos' || p.categoria === filtro.categoria) &&
        (filtro.epoca === 'Todas' || p.epocas?.includes(filtro.epoca)) &&
        (filtro.modoBio === 'Todos' ||
          (filtro.modoBio === 'Biologico' ? p.biologico : !p.biologico)) &&
        (filtro.precoMax === '' || p.preco <= Number(filtro.precoMax)) &&
        (!filtro.produtor || p.produtor._id === filtro.produtor) &&
        (p.produtor.produtor?.localidade || '').toLowerCase().includes(filtro.localidade.trim().toLowerCase()) &&
        [p.nome, ...(p.ingredientes || []), p.produtor.nome, p.produtor.produtor?.nomeExploracao || ''].some(v => v.toLowerCase().includes(filtro.q.trim().toLowerCase()))));
      setErro('');
      setACarregar(false);
      return;
    }
    const parametros = {
      q: filtro.q,
      categoria: filtro.categoria,
      epoca: filtro.epoca,
      ...(filtro.produtor ? { produtor: filtro.produtor } : {}),
      ...(filtro.localidade.trim() ? { localidade: filtro.localidade.trim() } : {}),
      ...(filtro.precoMax === '' ? {} : { precoMax: filtro.precoMax }),
      ...(filtro.modoBio === 'Todos' ? {} : { bio: String(filtro.modoBio === 'Biologico') })
    };
    const q = new URLSearchParams(parametros);
    const controller = new AbortController();
    setACarregar(true);
    const t = setTimeout(() => {
      api(`/products?${q}`, { signal: controller.signal }).then((dados) => {
        if (controller.signal.aborted) return;
        setProdutos(dados);
        setErro('');
      }).catch((e) => {
        if (!controller.signal.aborted) setErro(e.message);
      }).finally(() => {
        if (!controller.signal.aborted) setACarregar(false);
      });
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [filtro]);

  const produtosOrdenados = useMemo(() => {
    if (ordenacao === 'original') return produtos;
    const compararNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-PT', { sensitivity: 'base' });
    const comparadores = {
      'preco-asc': (a, b) => a.preco - b.preco || compararNome(a, b),
      'preco-desc': (a, b) => b.preco - a.preco || compararNome(a, b),
      'nome-asc': compararNome,
      'nome-desc': (a, b) => compararNome(b, a)
    };
    return [...produtos].sort(comparadores[ordenacao]);
  }, [produtos, ordenacao]);

  const totalPaginas = Math.max(1, Math.ceil(produtosOrdenados.length / PRODUTOS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * PRODUTOS_POR_PAGINA;
  const produtosPagina = produtosOrdenados.slice(inicio, inicio + PRODUTOS_POR_PAGINA);
  const paginasVisiveis = Array.from({ length: Math.min(5, totalPaginas) }, (_, i) =>
    Math.max(1, Math.min(paginaAtual - 2, totalPaginas - 4)) + i);

  function mudarPagina(proxima) {
    setPagina(proxima);
    inicioResultados.current?.focus({ preventScroll: true });
    inicioResultados.current?.scrollIntoView({ block: 'start' });
  }

  const mudar = (campo) => (e) => {
    setPagina(1);
    setFiltro((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  };

  const temFiltros = filtro.q !== '' || filtro.categoria !== 'Todos' ||
    filtro.epoca !== 'Todas' || filtro.modoBio !== 'Todos' || filtro.precoMax !== '' || filtro.produtor !== '' || filtro.localidade !== '' || ordenacao !== 'original';
  const filtrosAtivos = [
    filtro.q && { campo: 'q', valor: '', texto: `Pesquisa: ${filtro.q}` },
    filtro.categoria !== 'Todos' && { campo: 'categoria', valor: 'Todos', texto: filtro.categoria },
    filtro.epoca !== 'Todas' && { campo: 'epoca', valor: 'Todas', texto: filtro.epoca },
    filtro.modoBio !== 'Todos' && { campo: 'modoBio', valor: 'Todos', texto: MODOS_BIO.find(m => m.valor === filtro.modoBio)?.rotulo },
    filtro.precoMax !== '' && { campo: 'precoMax', valor: '', texto: `Até ${filtro.precoMax} €` },
    filtro.produtor && { campo: 'produtor', valor: '', texto: produtores.find(p => p._id === filtro.produtor)?.produtor?.nomeExploracao || produtores.find(p => p._id === filtro.produtor)?.nome || 'Produtor selecionado' },
    filtro.localidade && { campo: 'localidade', valor: '', texto: filtro.localidade }
  ].filter(Boolean);

  const filtrosAdicionais = filtrosAtivos.filter(f => f.campo !== 'q' && f.campo !== 'categoria').length;

  return (
    <div className="pagina-catalogo">
      <section className="catalogo-intro" aria-labelledby="titulo-catalogo">
        <div>
          <p className="catalogo-intro__regiao"><MapPin size={14} aria-hidden="true" /> Alto Minho · Produção local</p>
          <h1 id="titulo-catalogo">Sabores da nossa terra.</h1>
          <p className="catalogo-intro__descricao">Da horta, do forno e da quinta, diretamente à sua mesa.</p>
        </div>
        <Link to="/leiloes" className="catalogo-intro__leiloes">Explorar leilões <ArrowUpRight size={17} aria-hidden="true" /></Link>
      </section>

      <LeilaoDestaque />
      <h2 ref={inicioResultados} tabIndex={-1} className="visually-hidden catalogo-resultados-inicio">Produtos</h2>
      <section className="filtros" aria-label="Filtros">
        <div className="filtros__grupo filtros__pesquisa">
          <label className="filtros__legenda" htmlFor="pesquisa">Pesquisar produtos</label>
          <div className="filtros__campo-pesquisa">
            <Search size={18} aria-hidden="true" />
            <input id="pesquisa" type="search" className="form-control" placeholder="Nome, ingrediente ou produtor…"
              value={filtro.q} onChange={mudar('q')} />
          </div>
        </div>
        <button type="button" className="btn btn-outline-primary filtros__alternar"
          aria-expanded={filtrosAbertos} aria-controls="filtros-avancados" onClick={() => setFiltrosAbertos(!filtrosAbertos)}>
          <SlidersHorizontal size={18} aria-hidden="true" /> {filtrosAbertos ? 'Fechar filtros' : 'Mais filtros'}
          {filtrosAdicionais > 0 &&
            <span className="filtros__contador" aria-label={filtrosAdicionais + (filtrosAdicionais === 1 ? ' filtro adicional ativo' : ' filtros adicionais ativos')}>{filtrosAdicionais}</span>}
        </button>
        <div id="filtros-avancados" className={`filtros__avancados${filtrosAbertos ? ' filtros__avancados--abertos' : ''}`}>
          <div className="filtros__grupo">
            <label className="filtros__legenda" htmlFor="filtro-produtor">Produtor</label>
            <select id="filtro-produtor" className="form-select" value={filtro.produtor} onChange={mudar('produtor')}>
              <option value="">Todos os produtores</option>
              {produtores.map(p => <option key={p._id} value={p._id}>{p.produtor?.nomeExploracao || p.nome}</option>)}
            </select>
            {consultaProdutores.erro && <span role="alert">Não foi possível carregar os produtores. <button type="button" className="btn btn-link p-0" onClick={consultaProdutores.recarregar}>Tentar novamente</button></span>}
          </div>
          <div className="filtros__grupo">
            <label className="filtros__legenda" htmlFor="filtro-localidade">Localidade</label>
            <input id="filtro-localidade" className="form-control" type="search" maxLength={150} placeholder="Todas as localidades" value={filtro.localidade} onChange={mudar('localidade')} />
          </div>
          <div className="filtros__grupo">
            <label className="filtros__legenda" htmlFor="epoca">Época</label>
            <select id="epoca" className="form-select" value={filtro.epoca} onChange={mudar('epoca')}>
              {EPOCAS.map((epoca) => (
                <option key={epoca} value={epoca}>{epoca === 'Todas' ? 'Todas as épocas' : epoca}</option>
              ))}
            </select>
          </div>
          <div className="filtros__grupo">
            <label className="filtros__legenda" htmlFor="modo-bio">Modo biológico</label>
            <select id="modo-bio" className="form-select" value={filtro.modoBio} onChange={mudar('modoBio')}>
              {MODOS_BIO.map((modo) => (
                <option key={modo.valor} value={modo.valor}>{modo.valor === 'Todos' ? 'Todos os modos' : modo.rotulo}</option>
              ))}
            </select>
          </div>
          <div className="filtros__grupo">
            <label className="filtros__legenda" htmlFor="preco-max">Preço máximo (€)</label>
            <input id="preco-max" type="number" className="form-control" min="0" step="0.01"
              placeholder="Sem limite" value={filtro.precoMax} onChange={mudar('precoMax')} />
          </div>
        </div>
      </section>
      <nav className="catalogo-categorias" aria-label="Categorias dos produtos">
        {CATEGORIAS.map(categoria => <button key={categoria} type="button"
          aria-pressed={filtro.categoria === categoria}
          onClick={() => {
            setFiltro(atual => ({ ...atual, categoria }));
            setPagina(1);
          }}>{categoria}</button>)}
      </nav>

      {filtrosAtivos.length > 0 && <div className="catalogo-selecoes" aria-label="Filtros ativos">
        {filtrosAtivos.map(f => <button type="button" key={f.campo} aria-label={`Remover filtro: ${f.texto}`}
          onClick={() => { setFiltro(atual => ({ ...atual, [f.campo]: f.valor })); setPagina(1); }}>
          <span>{f.texto}</span><X size={14} aria-hidden="true" />
        </button>)}
      </div>}
      <div className="filtros__resumo">
        <span className="texto-secundario" role="status"><strong>{produtos.length}</strong> {produtos.length === 1 ? 'produto encontrado' : 'produtos encontrados'}</span>
        {temFiltros && <button type="button" className="btn btn-link filtros__limpar"
          onClick={() => {
            setFiltro(FILTRO_INICIAL);
            setOrdenacao('original');
            setPagina(1);
          }}>
          <X size={14} aria-hidden="true" /> Limpar filtros
        </button>}
        <div className="filtros__grupo filtros__ordenacao">
          <label className="filtros__legenda" htmlFor="ordenacao">Ordenar por</label>
          <select id="ordenacao" className="form-select" value={ordenacao} onChange={e => { setOrdenacao(e.target.value); setPagina(1); }}>
            {ORDENACOES.map(opcao => <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>)}
          </select>
        </div>
      </div>

      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      {aCarregar && <p className="texto-secundario" role="status">A carregar produtos…</p>}

      <section className="grelha-produtos" aria-label="Produtos" aria-busy={aCarregar}>
        {produtosPagina.map((p) => (
          <CartaoProduto key={p._id} produto={p}
            onAdicionar={utilizador?.papel === 'comprador' ? () => carrinho.adicionar(p) : undefined} />
        ))}
      </section>
      {!aCarregar && !erro && produtos.length > 0 && (
        <div className="catalogo-paginacao">
          <p className="catalogo-paginacao__intervalo" role="status">
            A mostrar {inicio + 1}–{inicio + produtosPagina.length} de {produtos.length} {produtos.length === 1 ? 'produto' : 'produtos'}
          </p>
          {totalPaginas > 1 && <nav aria-label="Paginação dos produtos" className="catalogo-paginacao__controlos">
            <button type="button" className="btn btn-outline-primary" disabled={paginaAtual === 1}
              onClick={() => mudarPagina(paginaAtual - 1)}>Anterior</button>
            <div className="catalogo-paginacao__numeros">
              {paginasVisiveis.map(numero => <button key={numero} type="button"
                className={`btn ${numero === paginaAtual ? 'btn-primary' : 'btn-outline-primary'}`}
                aria-label={`Página ${numero}`} aria-current={numero === paginaAtual ? 'page' : undefined}
                onClick={() => mudarPagina(numero)}>{numero}</button>)}
            </div>
            <span className="catalogo-paginacao__pagina">Página {paginaAtual} de {totalPaginas}</span>
            <button type="button" className="btn btn-outline-primary" disabled={paginaAtual === totalPaginas}
              onClick={() => mudarPagina(paginaAtual + 1)}>Seguinte</button>
          </nav>}
        </div>
      )}
      {!aCarregar && !erro && produtos.length === 0 && <p className="texto-secundario">Nenhum produto encontrado.</p>}
    </div>
  );
}

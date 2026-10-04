// Visitante: catálogo com pesquisa e filtros
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Leaf, MapPin, Search, SlidersHorizontal, Sprout, X } from 'lucide-react';
import CartaoProduto from '../components/CartaoProduto.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, USAR_DADOS_SIMULADOS } from '../api/client.js';
import produtosSimulados from '../data/produtos.json';

const CATEGORIAS = ['Todos', 'Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria', 'Outros'];
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
  const [filtro, setFiltro] = useState({ q: '', categoria: 'Todos', epoca: 'Todas', modoBio: 'Todos' });
  const [ordenacao, setOrdenacao] = useState('original');
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(!USAR_DADOS_SIMULADOS);
  const carrinho = useCarrinho();
  const { utilizador } = useAuth();

  useEffect(() => {
    if (USAR_DADOS_SIMULADOS) {
      // Semana 2: filtragem local sobre dados simulados
      setProdutos(produtosSimulados.filter((p) =>
        (filtro.categoria === 'Todos' || p.categoria === filtro.categoria) &&
        (filtro.epoca === 'Todas' || p.epocas?.includes(filtro.epoca)) &&
        (filtro.modoBio === 'Todos' ||
          (filtro.modoBio === 'Biologico' ? p.biologico : !p.biologico)) &&
        p.nome.toLowerCase().includes(filtro.q.toLowerCase())));
      setErro('');
      setACarregar(false);
      return;
    }
    const parametros = {
      q: filtro.q,
      categoria: filtro.categoria,
      epoca: filtro.epoca,
      bio: filtro.modoBio === 'Todos' ? '' : String(filtro.modoBio === 'Biologico')
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

  const mudar = (campo) => (e) =>
    setFiltro((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const temFiltros = filtro.q !== '' || filtro.categoria !== 'Todos' ||
    filtro.epoca !== 'Todas' || filtro.modoBio !== 'Todos' || ordenacao !== 'original';

  return (
    <>
      <section className="catalogo-intro" aria-labelledby="titulo-catalogo">
        <p className="catalogo-intro__regiao"><MapPin size={14} aria-hidden="true" /> Alto Minho · Produção local</p>
        <h1 id="titulo-catalogo">Sabores da nossa terra.<br /><span>Direto à sua mesa.</span></h1>
        <p className="catalogo-intro__descricao">Da horta, do forno e da quinta. Descubra os produtos e quem os produz.</p>
        <div className="catalogo-intro__rodape">
          <div className="catalogo-intro__valores">
            <span><Sprout size={17} aria-hidden="true" /> Produtores locais</span>
            <span><Leaf size={17} aria-hidden="true" /> Sabores da época</span>
          </div>
          <Link to="/leiloes" className="catalogo-intro__leiloes">Explorar leilões <ArrowUpRight size={17} aria-hidden="true" /></Link>
        </div>
      </section>

      <div className="catalogo-cabecalho">
        <h2>O nosso mercado</h2>
        <span><SlidersHorizontal size={15} aria-hidden="true" /> Encontre o seu próximo favorito</span>
      </div>
      <section className="filtros mb-3" aria-label="Filtros">
        <div className="filtros__grupo filtros__pesquisa">
          <label className="filtros__legenda" htmlFor="pesquisa">Pesquisar produtos</label>
          <div className="filtros__campo-pesquisa">
            <Search size={18} aria-hidden="true" />
            <input id="pesquisa" type="search" className="form-control" placeholder="Kiwi, mel, Alvarinho…"
              value={filtro.q} onChange={mudar('q')} />
          </div>
        </div>
        <div className="filtros__grupo">
          <label className="filtros__legenda" htmlFor="categoria">Categoria</label>
          <select id="categoria" className="form-select" value={filtro.categoria} onChange={mudar('categoria')}>
            {CATEGORIAS.map((categoria) => (
              <option key={categoria} value={categoria}>{categoria === 'Todos' ? 'Todas as categorias' : categoria}</option>
            ))}
          </select>
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
          <label className="filtros__legenda" htmlFor="ordenacao">Ordenar por</label>
          <select id="ordenacao" className="form-select" value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)}>
            {ORDENACOES.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>{opcao.rotulo}</option>
            ))}
          </select>
        </div>
        {/* TODO: filtro por preço máximo */}
      </section>

      <div className="filtros__resumo">
        <span className="texto-secundario" role="status"><strong>{produtos.length}</strong> {produtos.length === 1 ? 'produto encontrado' : 'produtos encontrados'}</span>
        <button type="button" className="btn btn-link filtros__limpar" disabled={!temFiltros}
          onClick={() => {
            setFiltro({ q: '', categoria: 'Todos', epoca: 'Todas', modoBio: 'Todos' });
            setOrdenacao('original');
          }}>
          <X size={14} aria-hidden="true" /> Limpar filtros
        </button>
      </div>

      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      {aCarregar && <p className="texto-secundario" role="status">A carregar produtos…</p>}

      <section className="grelha-produtos" aria-label="Produtos" aria-busy={aCarregar}>
        {produtosOrdenados.map((p) => (
          <CartaoProduto key={p._id} produto={p}
            onAdicionar={utilizador?.papel === 'comprador' ? () => carrinho.adicionar(p) : undefined} />
        ))}
      </section>
      {!aCarregar && !erro && produtos.length === 0 && <p className="texto-secundario">Nenhum produto encontrado.</p>}
    </>
  );
}

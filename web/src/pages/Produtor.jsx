// Visitante: página pública do produtor
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Star, Sprout, Package } from 'lucide-react';
import CartaoProduto from '../components/CartaoProduto.jsx';
import CartaoAvaliacao from '../components/CartaoAvaliacao.jsx';
import { USAR_DADOS_SIMULADOS } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import produtosSimulados from '../data/produtos.json';

export default function Produtor() {
  const { id } = useParams();
  const { dados, erro, aCarregar, recarregar } = useApi(USAR_DADOS_SIMULADOS ? null : `/producers/${encodeURIComponent(id)}`);
  const avaliacoes = useApi(USAR_DADOS_SIMULADOS ? null : `/reviews?produtor=${encodeURIComponent(id)}`);
  const { utilizador } = useAuth();
  const carrinho = useCarrinho();
  const simulados = USAR_DADOS_SIMULADOS ? produtosSimulados.filter((p) => p.produtor._id === id) : [];
  const produtor = USAR_DADOS_SIMULADOS ? simulados[0]?.produtor : dados?.produtor;
  const produtos = USAR_DADOS_SIMULADOS ? simulados : dados?.produtos || [];
  const detalhes = produtor?.produtor;

  if (!USAR_DADOS_SIMULADOS && aCarregar) return <p role="status">A carregar produtor…</p>;
  if (erro) return (
    <div className="alert alert-danger" role="alert">
      <p>{erro}</p>
      <button type="button" className="btn btn-outline-danger" onClick={recarregar}>Tentar novamente</button>
    </div>
  );
  if (!produtor) return <><h1>Produtor não encontrado</h1><Link to="/">Voltar ao catálogo</Link></>;

  return (
    <>
      <Link to="/" className="ligacao-voltar"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao catálogo</Link>
      <section className="produtor-apresentacao">
        <div className="produtor-apresentacao__identidade"><span className="produtor-apresentacao__simbolo"><Sprout size={38} aria-hidden="true" /></span><div>
        <p className="catalogo-intro__regiao">Produção local · Alto Minho</p>
        <h1>{detalhes?.nomeExploracao || produtor.nome}</h1>
        {detalhes?.localidade && <p className="produtor-apresentacao__localidade"><MapPin size={17} aria-hidden="true" />{detalhes.localidade}</p>}
        </div></div><div className="produtor-apresentacao__numeros"><div><Package size={20} aria-hidden="true" /><strong>{produtos.length}</strong><span>produtos no catálogo</span></div>
        {!USAR_DADOS_SIMULADOS && dados.avaliacaoMedia != null && (
          <div><Star size={20} aria-hidden="true" /><strong>{dados.avaliacaoMedia.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} / 5</strong><span>avaliação média</span></div>
        )}
        </div>
      </section>
      {detalhes?.descricao && <section className="produtor-historia"><p className="pagina-sobretitulo">QUEM PRODUZ</p><h2>A nossa história</h2><p>{detalhes.descricao}</p></section>}
      <div className="secao-cabecalho"><h2>Produtos de {produtor.nome}</h2><span>Diretamente da exploração</span></div>
      <section className="grelha-produtos" aria-label="Produtos do produtor">
        {produtos.map((p) => (
          <CartaoProduto key={p._id} produto={{ ...p, produtor }}
            onAdicionar={utilizador?.papel === 'comprador' ? () => carrinho.adicionar({ ...p, produtor }) : undefined} />
        ))}
      </section>
      {produtos.length === 0 && <p className="texto-secundario">Sem produtos disponíveis.</p>}
      <section aria-labelledby="avaliacoes-produtor" className="produtor-avaliacoes">
        <h2 id="avaliacoes-produtor">Avaliações do produtor</h2>
        {avaliacoes.aCarregar && <p role="status">A carregar avaliações…</p>}
        {avaliacoes.erro && <p role="alert">{avaliacoes.erro} <button className="btn btn-outline-success" onClick={avaliacoes.recarregar}>Tentar novamente</button></p>}
        {!avaliacoes.aCarregar && !avaliacoes.erro && !avaliacoes.dados?.length && <p>Ainda não há avaliações deste produtor.</p>}
        {avaliacoes.dados?.map(r => <CartaoAvaliacao key={r._id} avaliacao={r} />)}
      </section>
    </>
  );
}

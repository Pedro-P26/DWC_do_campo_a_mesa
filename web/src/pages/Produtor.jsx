// Visitante: página pública do produtor
import { Link, useParams } from 'react-router-dom';
import { MapPin, Star } from 'lucide-react';
import CartaoProduto from '../components/CartaoProduto.jsx';
import { USAR_DADOS_SIMULADOS } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import produtosSimulados from '../data/produtos.json';

export default function Produtor() {
  const { id } = useParams();
  const { dados, erro, aCarregar, recarregar } = useApi(USAR_DADOS_SIMULADOS ? null : `/producers/${encodeURIComponent(id)}`);
  const { utilizador } = useAuth();
  const carrinho = useCarrinho();
  const simulados = USAR_DADOS_SIMULADOS ? produtosSimulados.filter((p) => p.produtor._id === id) : [];
  const produtor = USAR_DADOS_SIMULADOS ? simulados[0]?.produtor : dados?.produtor;
  const produtos = USAR_DADOS_SIMULADOS ? simulados : dados?.produtos || [];
  const detalhes = produtor?.produtor;
  const coordenadas = detalhes?.localizacao;
  const temCoordenadas = Number.isFinite(coordenadas?.lat) && Number.isFinite(coordenadas?.lng) &&
    Math.abs(coordenadas.lat) <= 90 && Math.abs(coordenadas.lng) <= 180;

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
      <Link to="/" className="d-inline-block mb-3">Voltar ao catálogo</Link>
      <section className="produtor-apresentacao">
        <p className="catalogo-intro__regiao">Produção local · Alto Minho</p>
        <h1>{detalhes?.nomeExploracao || produtor.nome}</h1>
        {detalhes?.localidade && <p className="produtor-apresentacao__localidade"><MapPin size={17} aria-hidden="true" />{detalhes.localidade}</p>}
        {detalhes?.descricao && <p>{detalhes.descricao}</p>}
        {!USAR_DADOS_SIMULADOS && dados.avaliacaoMedia != null && (
          <p><Star size={16} aria-hidden="true" /> {dados.avaliacaoMedia.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} / 5</p>
        )}
        {temCoordenadas && (
          <iframe className="produtor-apresentacao__mapa" title={`Localização de ${produtor.nome}`} loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${coordenadas.lng - .02},${coordenadas.lat - .015},${coordenadas.lng + .02},${coordenadas.lat + .015}&layer=mapnik&marker=${coordenadas.lat},${coordenadas.lng}`} />
        )}
      </section>
      <h2 className="h4 mb-3">Produtos de {produtor.nome}</h2>
      <section className="grelha-produtos" aria-label="Produtos do produtor">
        {produtos.map((p) => (
          <CartaoProduto key={p._id} produto={{ ...p, produtor }}
            onAdicionar={utilizador?.papel === 'comprador' ? () => carrinho.adicionar({ ...p, produtor }) : undefined} />
        ))}
      </section>
      {produtos.length === 0 && <p className="texto-secundario">Sem produtos disponíveis.</p>}
    </>
  );
}

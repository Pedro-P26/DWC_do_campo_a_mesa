// Componente reutilizável: cartão de produto do catálogo
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Leaf, MapPin, ShoppingBasket, Star } from 'lucide-react';

const euro = (v) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

export default function CartaoProduto({ produto, onAdicionar }) {
  const [imagemFalhada, setImagemFalhada] = useState(null);
  const categoria = (produto.categoria || 'Outros').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const localidade = produto.produtor?.produtor?.localidade;
  const temAvaliacao = Number.isFinite(produto.avaliacaoMedia) && produto.numeroAvaliacoes > 0;
  const media = temAvaliacao ? produto.avaliacaoMedia.toLocaleString('pt-PT', { maximumFractionDigits: 1 }) : null;
  const textoAvaliacao = temAvaliacao ? `${media} de 5, ${produto.numeroAvaliacoes} ${produto.numeroAvaliacoes === 1 ? 'avaliação' : 'avaliações'}` : 'Sem avaliações';

  return (
    <article className="card cartao-produto h-100">
      <Link to={`/produtos/${produto._id}`} className={`cartao-produto__media cat-${categoria}`}
        aria-label={`Ver detalhes de ${produto.nome}`}>
        {produto.imagemUrl && imagemFalhada !== produto.imagemUrl ? (
          <img src={produto.imagemUrl} alt={produto.nome} loading="lazy" width="700" height="500"
            onError={() => setImagemFalhada(produto.imagemUrl)} />
        ) : (
          <div className="cartao-produto__imagem" aria-label={`Produto sem fotografia: ${produto.nome}`}>
            <span className="cartao-produto__inicial" aria-hidden="true">{produto.nome.charAt(0)}</span>
          </div>
        )}
        <span className={`cartao-produto__etiqueta cat-${categoria}`}>{produto.categoria || 'Outros'}</span>
        {produto.biologico && <span className="etiqueta-bio"><Leaf size={12} aria-hidden="true" /> Biológico</span>}
      </Link>
      <div className="card-body d-flex flex-column">
        <h3><Link to={`/produtos/${produto._id}`}>{produto.nome}</Link></h3>
        {produto.stock === 0 && <span className="cartao-produto__esgotado">Esgotado</span>}
        <p className="cartao-produto__produtor">
          {produto.produtor?._id ? (
            <Link to={`/produtores/${produto.produtor._id}`}>{produto.produtor.nome}</Link>
          ) : produto.produtor?.nome}
        </p>
        {localidade && <p className="cartao-produto__origem"><MapPin size={13} aria-hidden="true" />{localidade}</p>}
        <div className="cartao-produto__rodape mt-auto"><p className="preco">
          {euro(produto.preco)} <span>/ {produto.unidade}</span>
        </p><span className="cartao-produto__avaliacao" role="img"
          aria-label={textoAvaliacao} title={textoAvaliacao}>
          <Star size={15} aria-hidden="true" fill={temAvaliacao ? 'currentColor' : 'none'} />
          <strong aria-hidden="true">{media || '—'}</strong>
          {temAvaliacao && <small aria-hidden="true">({produto.numeroAvaliacoes})</small>}
        </span></div>
        {onAdicionar && (
          <button type="button" className="btn btn-success w-100" onClick={onAdicionar} disabled={produto.stock === 0}>
            <ShoppingBasket size={16} aria-hidden="true" /> Adicionar
          </button>
        )}
      </div>
    </article>
  );
}

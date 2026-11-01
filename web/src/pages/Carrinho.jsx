import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Leaf, Minus, Package, Plus, ShoppingBasket, Trash2, Truck } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Carrinho() {
  const { linhas, remover, alterarQuantidade, esvaziar, total } = useCarrinho();
  const { token } = useAuth();
  const [tipo, setTipo] = useState('levantamento');
  const [morada, setMorada] = useState('');
  const [erro, setErro] = useState('');
  const [encomendas, setEncomendas] = useState([]);
  const [aEnviar, setAEnviar] = useState(false);
  const pedido = useRef(false);

  async function finalizar(e) {
    e.preventDefault();
    if (pedido.current || !linhas.length) return;
    if (tipo === 'entrega' && !morada.trim()) {
      setErro('Indique a morada de entrega.');
      return;
    }
    pedido.current = true;
    setAEnviar(true);
    setErro('');
    try {
      const criadas = await api('/orders', { metodo: 'POST', token, corpo: {
        linhas: linhas.map(({ produto, quantidade }) => ({ produto: produto._id, quantidade })),
        entrega: { tipo, ...(tipo === 'entrega' ? { morada: morada.trim() } : {}) }
      } });
      setEncomendas(criadas);
      esvaziar();
    } catch (err) {
      setErro(err.message);
    } finally {
      pedido.current = false;
      setAEnviar(false);
    }
  }
  const artigos = linhas.reduce((soma, linha) => soma + linha.quantidade, 0);
  return (
    <div className="pagina-carrinho">
      <header className="pagina-cabecalho">
        <div><p className="pagina-sobretitulo">DA NOSSA TERRA PARA SI</p><h1>Carrinho</h1>
          <p>Os seus produtos locais, a um passo de chegar à mesa.</p></div>
        <Link to="/" className="carrinho-continuar"><ArrowLeft size={16} aria-hidden="true" /> Continuar a comprar</Link>
      </header>
      {erro && <p className="alert alert-danger" role="alert">{erro}</p>}
      {encomendas.length > 0 && <div className="carrinho-sucesso" role="status">
        <CheckCircle2 size={24} aria-hidden="true" /><div>
          <strong>Compra concluída: {encomendas.length} {encomendas.length === 1 ? 'encomenda criada' : 'encomendas criadas'}.</strong>
          <Link to="/encomendas">Ver as minhas encomendas <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>}
      <form onSubmit={finalizar}>
        <fieldset disabled={aEnviar} className="carrinho-campos">
          {linhas.length === 0 ? <section className="carrinho-vazio" aria-label="Carrinho vazio">
            <span className="carrinho-vazio__icone"><ShoppingBasket size={34} aria-hidden="true" /></span>
            <h2>O carrinho está vazio.</h2>
            <p>Descubra os produtos dos nossos produtores e escolha os seus favoritos.</p>
            <p className="carrinho-vazio__total">Total: {total.toFixed(2)} €</p>
            <Link to="/" className="btn btn-success">Explorar os produtos <ArrowRight size={17} aria-hidden="true" /></Link>
          </section> : <div className="carrinho-layout">
            <section className="carrinho-produtos" aria-labelledby="titulo-artigos">
              <div className="carrinho-produtos__cabecalho"><h2 id="titulo-artigos">Os seus produtos</h2>
                <span>{artigos} {artigos === 1 ? 'unidade' : 'unidades'}</span></div>
              <ul className="carrinho-lista">
                {linhas.map(({ produto, quantidade }) => (
                  <li key={produto._id} className="list-group-item carrinho-artigo">
                    <Link to={`/produtos/${produto._id}`} className="carrinho-artigo__imagem" aria-label={`Ver ${produto.nome}`}>
                      <ImagemProduto produto={produto} />
                    </Link>
                    <div className="carrinho-artigo__info">
                      <h3><Link to={`/produtos/${produto._id}`}>{produto.nome}</Link></h3>
                      {produto.produtor?.nome && <p className="carrinho-artigo__produtor">{produto.produtor.produtor?.nomeExploracao || produto.produtor.nome}</p>}
                      <p className="carrinho-artigo__preco">{euro(produto.preco)} <span>/ {produto.unidade || 'unidade'}</span></p>
                    </div>
                    <div className="carrinho-artigo__quantidade">
                      <label htmlFor={`quantidade-${produto._id}`}>Quantidade</label>
                      <div className="carrinho-quantidade">
                        <button type="button" aria-label={`Diminuir quantidade de ${produto.nome}`} disabled={quantidade <= 1}
                          onClick={() => alterarQuantidade(produto._id, quantidade - 1)}><Minus size={16} aria-hidden="true" /></button>
                        <input id={`quantidade-${produto._id}`} type="number" min="1" max={produto.stock} step="1" value={quantidade}
                          onChange={e => { if (e.target.value !== '') alterarQuantidade(produto._id, Number(e.target.value)); }} />
                        <button type="button" aria-label={`Aumentar quantidade de ${produto.nome}`} disabled={quantidade >= produto.stock}
                          onClick={() => alterarQuantidade(produto._id, quantidade + 1)}><Plus size={16} aria-hidden="true" /></button>
                      </div>
                    </div>
                    <div className="carrinho-artigo__subtotal"><span>Subtotal</span><strong>{euro(produto.preco * quantidade)}</strong></div>
                    <button type="button" className="carrinho-artigo__remover" onClick={() => remover(produto._id)}>
                      <Trash2 size={15} aria-hidden="true" /> Remover
                    </button>
                  </li>
                ))}
              </ul>
              <div className="carrinho-produtos__rodape"><span><Leaf size={16} aria-hidden="true" /> Diretamente dos produtores locais</span>
                <button type="button" className="carrinho-esvaziar" onClick={esvaziar}>Esvaziar carrinho</button></div>
            </section>
            <section className="carrinho-resumo" aria-labelledby="titulo-entrega">
              <div className="carrinho-resumo__titulo"><ShoppingBasket size={20} aria-hidden="true" /><h2 id="titulo-entrega">Finalizar compra</h2></div>
              <p className="carrinho-resumo__nota">Será criada uma encomenda por produtor.</p>
              <div className="carrinho-resumo__total"><span>{linhas.length} {linhas.length === 1 ? 'produto selecionado' : 'produtos selecionados'}</span>
                <p>Total: <strong>{total.toFixed(2)} €</strong></p></div>
              <label htmlFor="tipo-entrega" className="form-label">Receber os produtos</label>
              <select id="tipo-entrega" className="form-select" value={tipo} onChange={e => setTipo(e.target.value)}>
                <option value="levantamento">Levantamento</option><option value="entrega">Entrega</option>
              </select>
              <p className="carrinho-resumo__rececao">{tipo === 'levantamento' ? <Package size={17} aria-hidden="true" /> : <Truck size={17} aria-hidden="true" />}
                {tipo === 'levantamento' ? 'Recolha os seus produtos junto de cada produtor.' : 'Indique onde pretende receber os produtos.'}</p>
              {tipo === 'entrega' && <div className="carrinho-resumo__morada">
                <label htmlFor="morada-entrega" className="form-label">Morada de entrega</label>
                <textarea id="morada-entrega" className="form-control" autoComplete="street-address" required rows={3}
                  value={morada} onChange={e => setMorada(e.target.value)} />
              </div>}
              <button className="btn btn-success carrinho-resumo__finalizar" type="submit">{aEnviar ? 'A finalizar…' : 'Finalizar compra'}<ArrowRight size={18} aria-hidden="true" /></button>
            </section>
          </div>}
        </fieldset>
      </form>
    </div>
  );
}

const euro = valor => valor.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

function ImagemProduto({ produto }) {
  const [falhou, setFalhou] = useState(false);
  return produto.imagemUrl && !falhou
    ? <img src={produto.imagemUrl} alt={produto.nome} loading="lazy" onError={() => setFalhou(true)} />
    : <Package size={28} aria-hidden="true" />;
}

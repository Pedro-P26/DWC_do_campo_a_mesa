import { useCarrinho } from '../context/CarrinhoContext.jsx';
import PorImplementar from '../components/PorImplementar.jsx';

export default function Carrinho() {
  const { linhas, remover, alterarQuantidade, esvaziar, total } = useCarrinho();
  return (
    <>
      <h1>Carrinho</h1>
      {linhas.length === 0 ? <p>O carrinho está vazio.</p> : (
        <ul className="list-group mb-3">
          {linhas.map(({ produto, quantidade }) => (
            <li key={produto._id} className="list-group-item d-flex justify-content-between align-items-center flex-wrap gap-3">
              <span className="flex-grow-1">{produto.nome}</span>
              <div className="d-flex align-items-center gap-2">
                <label htmlFor={`quantidade-${produto._id}`} className="small">Quantidade</label>
                <input id={`quantidade-${produto._id}`} type="number" className="form-control form-control-sm"
                  style={{ width: '5rem' }} min="1" max={produto.stock} step="1" value={quantidade}
                  onChange={(e) => {
                    if (e.target.value !== '') alterarQuantidade(produto._id, Number(e.target.value));
                  }} />
              </div>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remover(produto._id)}>Remover</button>
            </li>
          ))}
        </ul>
      )}
      <p className="fw-bold">Total: {total.toFixed(2)} €</p>
      {linhas.length > 0 && <button type="button" className="btn btn-outline-danger mb-3" onClick={esvaziar}>Esvaziar carrinho</button>}
      <PorImplementar passo={3}>
        escolher levantamento ou entrega e submeter com <code>POST /api/orders</code> (uma encomenda por produtor).
      </PorImplementar>
    </>
  );
}

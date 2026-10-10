import { useCarrinho } from '../context/CarrinhoContext.jsx';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
  return (
    <>
      <h1>Carrinho</h1>
      {erro && <p className="alert alert-danger" role="alert">{erro}</p>}
      {encomendas.length > 0 && <div className="alert alert-success" role="status">
        Compra concluída: {encomendas.length} {encomendas.length === 1 ? 'encomenda criada' : 'encomendas criadas'}.
        <Link className="d-block" to="/encomendas">Ver as minhas encomendas</Link>
      </div>}
      <form onSubmit={finalizar}>
      <fieldset disabled={aEnviar}>
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
      {linhas.length > 0 && <section className="formulario-estreito ms-0" aria-labelledby="titulo-entrega">
        <h2 id="titulo-entrega">Finalizar compra</h2>
        <p>Será criada uma encomenda por produtor.</p>
        <label htmlFor="tipo-entrega" className="form-label">Receber os produtos</label>
        <select id="tipo-entrega" className="form-select mb-3" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="levantamento">Levantamento</option>
          <option value="entrega">Entrega</option>
        </select>
        {tipo === 'entrega' && <div className="mb-3">
          <label htmlFor="morada-entrega" className="form-label">Morada de entrega</label>
          <textarea id="morada-entrega" className="form-control" autoComplete="street-address" required
            value={morada} onChange={(e) => setMorada(e.target.value)} />
        </div>}
        <button className="btn btn-primary" type="submit">{aEnviar ? 'A finalizar…' : 'Finalizar compra'}</button>
      </section>}
      </fieldset>
      </form>
    </>
  );
}

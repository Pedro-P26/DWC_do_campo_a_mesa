import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
export default function NovoLeilao() {
  const { token, utilizador } = useAuth(); const navigate = useNavigate();
  const { dados: produtos } = useApi(`/products?produtor=${utilizador.id}`);
  const [erro, setErro] = useState(''); const [ocupado, setOcupado] = useState(false);
  async function submeter(e) {
    e.preventDefault(); if (ocupado) return; const f = new FormData(e.currentTarget); setOcupado(true); setErro('');
    try {
      const corpo = { lote: f.get('lote'), descricao: f.get('descricao'), quantidade: f.get('quantidade'),
        precoBase: Number(f.get('precoBase')), incremento: Number(f.get('incremento')), duracaoMinutos: Number(f.get('duracao')) };
      if (f.get('produto')) corpo.produto = f.get('produto');
      if (f.get('inicio')) corpo.iniciaEm = new Date(f.get('inicio')).toISOString();
      const l = await api('/auctions', { metodo: 'POST', token, corpo }); navigate(`/leiloes/${l._id}`);
    } catch (err) { setErro(err.message); } finally { setOcupado(false); }
  }
  return <form className="formulario-estreito" onSubmit={submeter}><h1>Criar leilão</h1>
    {!utilizador.produtor?.validado && <p role="alert">A conta precisa de validação para criar leilões.</p>}
    <fieldset disabled={ocupado || !utilizador.produtor?.validado}>
      <label htmlFor="lote">Lote</label><input id="lote" name="lote" className="form-control mb-2" maxLength={150} required />
      <label htmlFor="produto">Produto</label><select id="produto" name="produto" className="form-select mb-2"><option value="">Sem produto associado</option>{produtos?.map(p => <option value={p._id} key={p._id}>{p.nome}</option>)}</select>
      <label htmlFor="descricao">Descrição</label><textarea id="descricao" name="descricao" className="form-control mb-2" maxLength={1000} />
      <label htmlFor="quantidade">Quantidade do lote</label><input id="quantidade" name="quantidade" className="form-control mb-2" />
      <label htmlFor="precoBase">Preço base (€)</label><input id="precoBase" name="precoBase" type="number" min="0" step="0.01" className="form-control mb-2" required />
      <label htmlFor="incremento">Incremento (€)</label><input id="incremento" name="incremento" type="number" min="0.01" step="0.01" className="form-control mb-2" required />
      <label htmlFor="duracao">Duração (minutos)</label><input id="duracao" name="duracao" type="number" min="0.1" step="0.1" defaultValue="30" className="form-control mb-2" required />
      <label htmlFor="inicio">Início (vazio para começar agora)</label><input id="inicio" name="inicio" type="datetime-local" className="form-control mb-3" />
      {erro && <p role="alert" className="alert alert-danger">{erro}</p>}
      <button className="btn btn-success" type="submit">{ocupado ? 'A criar…' : 'Criar leilão'}</button>
    </fieldset>
  </form>;
}

import { useState } from 'react';
const categorias = ['Hortícolas', 'Fruta', 'Mel', 'Vinho', 'Queijo', 'Padaria', 'Outros'];
const epocas = ['Primavera', 'Verão', 'Outono', 'Inverno'];
export default function FormularioProduto({ produto, ocupado, guardar, cancelar }) {
  const [dados, setDados] = useState(() => ({ nome: '', descricao: '', categoria: 'Hortícolas', preco: '', unidade: 'kg', stock: 0, biologico: false, epocas: [], ...produto, ingredientes: (produto.ingredientes || []).join(', ') }));
  const alterar = e => setDados(d => ({ ...d, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  function submeter(e) {
    e.preventDefault(); guardar({ nome: dados.nome.trim(), descricao: dados.descricao, categoria: dados.categoria,
      ingredientes: dados.ingredientes.split(',').map(s => s.trim()).filter(Boolean),
      preco: Number(dados.preco), unidade: dados.unidade.trim(), stock: Number(dados.stock), biologico: dados.biologico, epocas: dados.epocas });
  }
  return <form className="card p-3 mb-3" onSubmit={submeter} aria-label="Formulário de produto">
    <h3>{produto?._id ? 'Editar produto' : 'Novo produto'}</h3>
    <fieldset disabled={ocupado}>
      <div className="row g-3">
        <div className="col-md-6"><label htmlFor="produto-nome">Nome</label><input id="produto-nome" name="nome" className="form-control" maxLength={150} required value={dados.nome} onChange={alterar} /></div>
        <div className="col-md-6"><label htmlFor="produto-categoria">Categoria</label><select id="produto-categoria" name="categoria" className="form-select" value={dados.categoria} onChange={alterar}>{categorias.map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="col-12"><label htmlFor="produto-descricao">Descrição</label><textarea id="produto-descricao" name="descricao" className="form-control" maxLength={1000} value={dados.descricao} onChange={alterar} /></div>
        <div className="col-12"><label htmlFor="produto-ingredientes">Ingredientes (separados por vírgulas)</label><input id="produto-ingredientes" name="ingredientes" className="form-control" value={dados.ingredientes} onChange={alterar} /><small>Nos produtos preparados, indique os ingredientes para facilitar a pesquisa.</small></div>
        <div className="col-md-4"><label htmlFor="produto-preco">Preço (€)</label><input id="produto-preco" name="preco" type="number" min="0" step="0.01" className="form-control" required value={dados.preco} onChange={alterar} /></div>
        <div className="col-md-4"><label htmlFor="produto-unidade">Unidade</label><input id="produto-unidade" name="unidade" className="form-control" required value={dados.unidade} onChange={alterar} /></div>
        <div className="col-md-4"><label htmlFor="produto-stock">Stock</label><input id="produto-stock" name="stock" type="number" min="0" step="1" className="form-control" required value={dados.stock} onChange={alterar} /></div>
        <div className="col-12"><label><input type="checkbox" name="biologico" checked={dados.biologico} onChange={alterar} /> Biológico</label></div>
        <div className="col-12"><p className="mb-1">Épocas</p><div className="d-flex gap-3 flex-wrap">{epocas.map(epoca => <label key={epoca}><input type="checkbox" checked={dados.epocas.includes(epoca)} onChange={e => setDados(d => ({ ...d, epocas: e.target.checked ? [...d.epocas, epoca] : d.epocas.filter(x => x !== epoca) }))} /> {epoca}</label>)}</div></div>
      </div>
      <div className="d-flex gap-2 mt-3"><button className="btn btn-success" type="submit">{ocupado ? 'A guardar…' : 'Guardar produto'}</button><button className="btn btn-outline-secondary" type="button" onClick={cancelar}>Cancelar</button></div>
    </fieldset>
  </form>;
}

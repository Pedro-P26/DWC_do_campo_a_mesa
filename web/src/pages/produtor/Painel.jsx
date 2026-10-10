import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import ListaEncomendas from '../../components/ListaEncomendas.jsx';
import FormularioProduto from '../../components/FormularioProduto.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { useEventoSocket } from '../../context/SocketContext.jsx';
import { api, enviarFicheiro } from '../../api/client.js';
const euro = v => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);
const LIMIAR_STOCK = 5;
export default function PainelProdutor() {
  const { token, utilizador } = useAuth();
  const produtos = useApi(`/products?produtor=${utilizador.id}&ordenar=nome`);
  const encomendas = useApi('/orders');
  const avaliacoes = useApi(`/reviews?produtor=${utilizador.id}`);
  const [edicao, setEdicao] = useState(null); const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(''); const [mensagem, setMensagem] = useState(''); const [aEliminar, setAEliminar] = useState(null);
  const refreshProdutos = produtos.recarregar;
  useEventoSocket('nova-encomenda', refreshProdutos);
  useEventoSocket('connect', refreshProdutos);
  const atualizarTudo = useCallback(() => Promise.all([produtos.recarregar(), encomendas.recarregar(), avaliacoes.recarregar()]), [produtos.recarregar, encomendas.recarregar, avaliacoes.recarregar]);
  const agora = new Date();
  const vendas = encomendas.dados?.filter(o => o.estado !== 'pendente' && new Date(o.createdAt).getMonth() === agora.getMonth() && new Date(o.createdAt).getFullYear() === agora.getFullYear()).reduce((s, o) => s + o.total, 0);
  const porTratar = encomendas.dados?.filter(o => o.estado !== 'entregue').length;
  const media = avaliacoes.dados?.length ? avaliacoes.dados.reduce((s, r) => s + r.classificacao, 0) / avaliacoes.dados.length : null;
  const baixos = produtos.dados?.filter(p => p.stock <= LIMIAR_STOCK) || [];
  async function guardar(corpo) {
    setOcupado(true); setErro(''); setMensagem('');
    try { await api(edicao._id ? `/products/${edicao._id}` : '/products', { metodo: edicao._id ? 'PUT' : 'POST', token, corpo }); setEdicao(null); setMensagem('Produto guardado.'); await produtos.recarregar(); }
    catch (e) { setErro(e.message); } finally { setOcupado(false); }
  }
  async function eliminar(p) {
    setOcupado(true); setErro(''); setMensagem('');
    try { await api(`/products/${p._id}`, { metodo: 'DELETE', token }); setAEliminar(null); if (edicao?._id === p._id) setEdicao(null); setMensagem('Produto eliminado.'); await produtos.recarregar(); }
    catch (e) { setErro(e.message); } finally { setOcupado(false); }
  }
  async function imagem(e, p) {
    const input = e.target, ficheiro = input.files?.[0]; if (!ficheiro) return;
    setErro(''); setMensagem('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(ficheiro.type) || ficheiro.size > 5 * 1024 * 1024) { setErro('Escolha uma imagem JPEG, PNG ou WebP até 5 MB.'); input.value = ''; return; }
    setOcupado(true);
    try { await enviarFicheiro(`/products/${p._id}/imagem`, 'imagem', ficheiro, token); setMensagem('Imagem guardada.'); await produtos.recarregar(); }
    catch (e) { setErro(e.message); } finally { setOcupado(false); input.value = ''; }
  }
  return <>
    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><h1>Painel do produtor</h1><Link to="/produtor/leiloes/novo" className="btn btn-success">Criar leilão</Link></div>
    <button className="btn btn-outline-success mb-3" onClick={atualizarTudo} disabled={ocupado || produtos.aCarregar || encomendas.aCarregar || avaliacoes.aCarregar}>Atualizar painel</button>
    <div className="row g-3 mb-4">
      <div className="col-md-4"><div className="card p-3"><h2 className="h5">Vendas do mês</h2><p className="h3" data-testid="vendas-mes">{encomendas.erro ? 'Indisponível' : vendas === undefined ? 'A carregar…' : euro(vendas)}</p><small>Encomendas confirmadas, prontas ou entregues criadas no mês atual.</small></div></div>
      <div className="col-md-4"><div className="card p-3"><h2 className="h5">Encomendas por tratar</h2><p className="h3" data-testid="por-tratar">{encomendas.erro ? 'Indisponível' : porTratar ?? 'A carregar…'}</p><small>Encomendas que ainda não foram entregues.</small></div></div>
      <div className="col-md-4"><div className="card p-3"><h2 className="h5">Avaliação média</h2><p className="h3" data-testid="avaliacao-media">{avaliacoes.erro ? 'Indisponível' : !avaliacoes.dados ? 'A carregar…' : media === null ? 'Sem avaliações' : `${media.toFixed(1)} / 5`}</p><small>{avaliacoes.dados?.length ?? 0} avaliações visíveis.</small></div></div>
    </div>
    <h2>Stock baixo</h2><p>Produtos com {LIMIAR_STOCK} unidades de stock ou menos.</p>
    {produtos.dados && <div data-testid="stock-baixo" className={`alert ${baixos.length ? 'alert-warning' : 'alert-success'}`}>
      {baixos.length ? <ul className="mb-0">{baixos.map(p => <li key={p._id}>{p.nome}: {p.stock === 0 ? 'esgotado' : `${p.stock} ${p.unidade}`}</li>)}</ul> : 'Sem produtos com stock baixo.'}
    </div>}
    <h2>Catálogo</h2>
    {!utilizador.produtor?.validado && <p role="alert" className="alert alert-warning">Aguarde a validação da conta para criar produtos.</p>}
    {(erro || produtos.erro || avaliacoes.erro) && <p role="alert" className="alert alert-danger">{erro || produtos.erro || avaliacoes.erro}</p>}
    {mensagem && <p role="status" className="alert alert-success">{mensagem}</p>}
    <button className="btn btn-success mb-3" disabled={ocupado || !utilizador.produtor?.validado} onClick={() => { setEdicao({}); setErro(''); setMensagem(''); }}>Novo produto</button>
    {edicao && <FormularioProduto key={edicao._id || 'novo'} produto={edicao} ocupado={ocupado} guardar={guardar} cancelar={() => setEdicao(null)} />}
    {produtos.aCarregar && !produtos.dados && <p role="status">A carregar produtos…</p>}
    {produtos.dados?.length === 0 && <p>Ainda sem produtos. Crie o primeiro produto.</p>}
    <div className="row g-3 mb-4">{produtos.dados?.map(p => <div className="col-md-6 col-xl-4" key={p._id}>
      <article className="card p-3 h-100" data-testid={`produto-${p._id}`}>
        {p.imagemUrl && <img className="img-fluid rounded mb-2" style={{ height: 160, objectFit: 'cover' }} src={p.imagemUrl} alt={p.nome} />}
        <h3 className="h5">{p.nome}</h3><p>{p.categoria} · {euro(p.preco)} / {p.unidade}</p><p>Stock: {p.stock} {p.unidade}{p.stock <= LIMIAR_STOCK && <span className="badge text-bg-warning ms-2">{p.stock === 0 ? 'Esgotado' : 'Stock baixo'}</span>}</p>
        <p>{p.descricao}</p><p>{p.biologico ? 'Biológico' : ''}{p.epocas.length ? ` · ${p.epocas.join(', ')}` : ''}</p>
        <div className="d-flex gap-2 mb-2"><button className="btn btn-outline-success" disabled={ocupado} onClick={() => { setEdicao(p); setErro(''); setMensagem(''); }}>Editar</button><button className="btn btn-outline-danger" disabled={ocupado} onClick={() => setAEliminar(p._id)}>Eliminar</button></div>
        {aEliminar === p._id && <div className="alert alert-warning"><p>Eliminar o produto «{p.nome}»?</p><button className="btn btn-danger me-2" disabled={ocupado} onClick={() => eliminar(p)}>Confirmar eliminação</button><button className="btn btn-outline-secondary" disabled={ocupado} onClick={() => setAEliminar(null)}>Cancelar eliminação</button></div>}
        <label htmlFor={`imagem-${p._id}`}>Imagem (JPEG, PNG ou WebP, até 5 MB)</label><input id={`imagem-${p._id}`} className="form-control" type="file" accept="image/jpeg,image/png,image/webp" disabled={ocupado} onChange={e => imagem(e, p)} />
      </article>
    </div>)}</div>
    <h2>Encomendas</h2><ListaEncomendas produtor fonte={encomendas} />
  </>;
}

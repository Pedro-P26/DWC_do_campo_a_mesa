import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Gavel, Package, Euro, Clock3, ArrowRight } from 'lucide-react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
export default function NovoLeilao() {
  const { token, utilizador } = useAuth(); const navigate = useNavigate();
  const { dados: produtos } = useApi(`/products?produtor=${utilizador.id}`);
  const [erro, setErro] = useState(''); const [ocupado, setOcupado] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
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
  return <div className="area-produtor">
    <Link to="/produtor" className="ligacao-voltar"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao painel</Link>
    <header className="pagina-cabecalho"><div><p className="pagina-sobretitulo">DO CAMPO À MELHOR OFERTA</p><h1>Criar leilão</h1><p>Transforme a sua colheita numa nova oportunidade de venda.</p></div><span className="pagina-emblema"><Gavel size={30} aria-hidden="true" /></span></header>
    <div className="editor-layout">
    <form className="formulario-editor" onSubmit={submeter}>
    {!utilizador.produtor?.validado && <p role="alert">A conta precisa de validação para criar leilões.</p>}
    <fieldset disabled={ocupado || !utilizador.produtor?.validado}>
      <section className="editor-secao"><div className="editor-secao__titulo"><span><Package size={20} aria-hidden="true" /></span><div><h2>O que vai a leilão?</h2><p>Apresente o lote aos compradores.</p></div></div>
      <label htmlFor="lote">Lote</label><input id="lote" name="lote" placeholder="Ex.: 50 kg de kiwi da colheita de outono" className="form-control mb-3" maxLength={150} required />
      <label htmlFor="produto">Produto</label><select id="produto" name="produto" className="form-select mb-2"><option value="">Sem produto associado</option>{produtos?.map(p => <option value={p._id} key={p._id}>{p.nome}</option>)}</select>
      <label htmlFor="descricao">Descrição</label><textarea id="descricao" name="descricao" placeholder="Qualidade, origem e condições de levantamento…" rows={4} className="form-control mb-3" maxLength={1000} />
      <label htmlFor="quantidade">Quantidade do lote</label><input id="quantidade" name="quantidade" className="form-control mb-2" />
      </section>
      <section className="editor-secao"><div className="editor-secao__titulo"><span><Euro size={20} aria-hidden="true" /></span><div><h2>Defina os valores</h2><p>Escolha o ponto de partida e o aumento de cada proposta.</p></div></div>
      <div className="editor-campos"><div>
      <label htmlFor="precoBase">Preço base (€)</label><input id="precoBase" name="precoBase" type="number" min="0" step="0.01" className="form-control mb-2" required />
      </div><div>
      <label htmlFor="incremento">Incremento (€)</label><input id="incremento" name="incremento" type="number" min="0.01" step="0.01" className="form-control mb-2" required />
      </div></div></section>
      <section className="editor-secao"><div className="editor-secao__titulo"><span><Clock3 size={20} aria-hidden="true" /></span><div><h2>Escolha o momento</h2><p>Comece agora ou agende para mais tarde.</p></div></div><div className="editor-campos"><div>
      <label htmlFor="duracao">Duração (minutos)</label><input id="duracao" name="duracao" type="number" min="0.1" step="0.1" defaultValue="30" className="form-control mb-2" required />
      </div><div>
      <label htmlFor="inicio">Início (vazio para começar agora)</label><input id="inicio" name="inicio" type="datetime-local" className="form-control mb-3" />
      </div></div></section>
      {erro && <p role="alert" className="alert alert-danger">{erro}</p>}
      <div className="editor-rodape"><Link to="/produtor" className="btn btn-outline-secondary">Cancelar</Link><button className="btn btn-success" type="submit">{ocupado ? 'A criar…' : 'Criar leilão'} <ArrowRight size={17} aria-hidden="true" /></button></div>
    </fieldset>
    </form>
    <button type="button" className="btn btn-outline-success editor-alternar-mobile editor-alternar-mobile--ajuda" aria-expanded={ajudaAberta} aria-controls="dicas-leilao"
      onClick={() => setAjudaAberta(!ajudaAberta)}>{ajudaAberta ? 'Ocultar dicas' : 'Dicas para criar um leilão'}</button>
    <aside id="dicas-leilao" className={`editor-conselho${ajudaAberta ? ' editor-conselho--aberto' : ''}`}><Gavel size={32} aria-hidden="true" /><p className="pagina-sobretitulo">CADA LOTE CONTA UMA HISTÓRIA</p><h2>Uma boa apresentação faz a diferença.</h2><p>Indique a variedade, a quantidade e o estado dos produtos. Os compradores vão saber exatamente pelo que estão a licitar.</p><div><strong>Antes de publicar</strong><ul><li>Confirme a quantidade disponível.</li><li>Defina um preço base para todo o lote.</li><li>Escolha tempo suficiente para receber propostas.</li></ul></div></aside>
    </div></div>;
}

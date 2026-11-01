import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, MapPin, Sprout, Save, Store } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';

export default function EditarPagina() {
  const { utilizador, token, atualizar } = useAuth();
  const [dados, setDados] = useState(() => ({ nomeExploracao: utilizador.produtor?.nomeExploracao || utilizador.nome,
    descricao: utilizador.produtor?.descricao || '', localidade: utilizador.produtor?.localidade || '' }));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [previaAberta, setPreviaAberta] = useState(false);
  const alterar = e => setDados(d => ({ ...d, [e.target.name]: e.target.value }));
  async function guardar(e) {
    e.preventDefault(); setErro(''); setMensagem('');
    setOcupado(true);
    try {
      await api('/producers/me', { metodo: 'PATCH', token, corpo: { nomeExploracao: dados.nomeExploracao.trim(),
        descricao: dados.descricao.trim(), localidade: dados.localidade.trim() } });
      await atualizar(); setMensagem('Página pública guardada.');
    } catch (err) { setErro(err.message); } finally { setOcupado(false); }
  }
  return <div className="area-produtor">
    <Link to="/produtor" className="ligacao-voltar"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao painel</Link>
    <header className="pagina-cabecalho"><div><p className="pagina-sobretitulo">A SUA EXPLORAÇÃO, A SUA HISTÓRIA</p><h1>Editar página pública</h1><p>Mostre quem está por trás dos produtos e de onde vêm.</p></div><span className="pagina-emblema"><Store size={30} aria-hidden="true" /></span></header>
    {erro && <p role="alert" className="alert alert-danger">{erro}</p>}
    {mensagem && <p role="status" className="alert alert-success">{mensagem}</p>}
    <button type="button" className="btn btn-outline-success editor-alternar-mobile" aria-expanded={previaAberta} aria-controls="previa-pagina"
      onClick={() => setPreviaAberta(!previaAberta)}>{previaAberta ? 'Ocultar pré-visualização' : 'Ver pré-visualização'}</button>
    <div className="editor-layout"><form onSubmit={guardar} aria-label="Página pública do produtor" className="formulario-editor">
      <fieldset disabled={ocupado}>
        <section className="editor-secao"><div className="editor-secao__titulo"><span><Sprout size={20} aria-hidden="true" /></span><div><h2>Identidade da exploração</h2><p>Estas informações aparecem na sua página pública.</p></div></div>
        <div className="mb-3"><label htmlFor="exploracao">Nome da exploração</label><input id="exploracao" name="nomeExploracao" className="form-control" required maxLength={150} value={dados.nomeExploracao} onChange={alterar} /></div>
        <div className="mb-3"><label htmlFor="descricao-publica">Descrição da exploração</label><textarea id="descricao-publica" name="descricao" className="form-control" maxLength={1000} rows={4} value={dados.descricao} onChange={alterar} /></div>
        <div className="mb-3"><label htmlFor="localidade-publica">Localidade</label><input id="localidade-publica" name="localidade" className="form-control" required maxLength={150} value={dados.localidade} onChange={alterar} /></div>
        </section><div className="editor-rodape"><Link to="/produtor" className="btn btn-outline-secondary">Cancelar</Link><button className="btn btn-success" type="submit"><Save size={17} aria-hidden="true" />{ocupado ? 'A guardar…' : 'Guardar página pública'}</button></div>
      </fieldset>
    </form>
    <aside id="previa-pagina" className={`editor-previa${previaAberta ? ' editor-previa--aberta' : ''}`}><p className="pagina-sobretitulo">PRÉ-VISUALIZAÇÃO</p><div className="editor-previa__marca"><Sprout size={36} aria-hidden="true" /></div><h2>{dados.nomeExploracao || 'A sua exploração'}</h2><p className="editor-previa__local"><MapPin size={16} aria-hidden="true" />{dados.localidade || 'A sua localidade'}</p><p className="editor-previa__descricao">{dados.descricao || 'Conte a história da sua exploração, o que produz e o que torna os seus produtos especiais.'}</p><small>Guarde as alterações para atualizar a página pública.</small>{utilizador.produtor?.validado && <Link to={`/produtores/${utilizador.id}`} className="btn btn-outline-success mt-3">Ver página pública <ArrowUpRight size={17} aria-hidden="true" /></Link>}</aside>
    </div></div>;
}

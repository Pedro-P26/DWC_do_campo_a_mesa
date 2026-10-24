import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../api/client.js';

export default function EditarPagina() {
  const { utilizador, token, atualizar } = useAuth();
  const [dados, setDados] = useState(() => ({ nomeExploracao: utilizador.produtor?.nomeExploracao || utilizador.nome,
    descricao: utilizador.produtor?.descricao || '', localidade: utilizador.produtor?.localidade || '',
    lat: utilizador.produtor?.localizacao?.lat ?? '', lng: utilizador.produtor?.localizacao?.lng ?? '' }));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const alterar = e => setDados(d => ({ ...d, [e.target.name]: e.target.value }));
  async function guardar(e) {
    e.preventDefault(); setErro(''); setMensagem('');
    if ((dados.lat === '') !== (dados.lng === '')) { setErro('Indique a latitude e a longitude, ou deixe ambas vazias.'); return; }
    setOcupado(true);
    try {
      await api('/producers/me', { metodo: 'PATCH', token, corpo: { nomeExploracao: dados.nomeExploracao.trim(),
        descricao: dados.descricao.trim(), localidade: dados.localidade.trim(),
        localizacao: dados.lat === '' ? null : { lat: Number(dados.lat), lng: Number(dados.lng) } } });
      await atualizar(); setMensagem('Página pública guardada.');
    } catch (err) { setErro(err.message); } finally { setOcupado(false); }
  }
  return <>
    <Link to="/produtor">Voltar ao painel</Link>
    <h1 className="mt-3">Editar página pública</h1>
    <p>Apresente a exploração e indique a localização que pretende mostrar no mapa público.</p>
    {erro && <p role="alert" className="alert alert-danger">{erro}</p>}
    {mensagem && <p role="status" className="alert alert-success">{mensagem}</p>}
    <form onSubmit={guardar} aria-label="Página pública do produtor" className="card p-3 mb-3">
      <fieldset disabled={ocupado}>
        <div className="mb-3"><label htmlFor="exploracao">Nome da exploração</label><input id="exploracao" name="nomeExploracao" className="form-control" required maxLength={150} value={dados.nomeExploracao} onChange={alterar} /></div>
        <div className="mb-3"><label htmlFor="descricao-publica">Descrição da exploração</label><textarea id="descricao-publica" name="descricao" className="form-control" maxLength={1000} rows={4} value={dados.descricao} onChange={alterar} /></div>
        <div className="mb-3"><label htmlFor="localidade-publica">Localidade</label><input id="localidade-publica" name="localidade" className="form-control" required maxLength={150} value={dados.localidade} onChange={alterar} /></div>
        <div className="row g-3 mb-3">
          <div className="col-md-6"><label htmlFor="latitude">Latitude</label><input id="latitude" name="lat" type="number" step="any" min="-90" max="90" className="form-control" value={dados.lat} onChange={alterar} /></div>
          <div className="col-md-6"><label htmlFor="longitude">Longitude</label><input id="longitude" name="lng" type="number" step="any" min="-180" max="180" className="form-control" value={dados.lng} onChange={alterar} /></div>
        </div>
        <p className="texto-secundario">Coordenadas em graus decimais. Deixe ambas vazias para retirar o mapa.</p>
        <button className="btn btn-success" type="submit">{ocupado ? 'A guardar…' : 'Guardar página pública'}</button>
      </fieldset>
    </form>
    {utilizador.produtor?.validado && <Link to={`/produtores/${utilizador.id}`}>Ver página pública</Link>}
  </>;
}

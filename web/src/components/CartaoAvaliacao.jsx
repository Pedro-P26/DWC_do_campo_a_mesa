import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Flag, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

export default function CartaoAvaliacao({ avaliacao }) {
  const { token } = useAuth();
  const location = useLocation();
  const [aEnviar, setAEnviar] = useState(false);
  const [denunciada, setDenunciada] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const data = avaliacao.createdAt ? new Date(avaliacao.createdAt) : null;

  async function denunciar() {
    if (aEnviar || denunciada) return;
    setAEnviar(true); setErro(''); setMensagem('');
    try {
      await api(`/reviews/${avaliacao._id}/denuncia`, { metodo: 'POST', token });
      setDenunciada(true); setMensagem('Denúncia enviada para análise da administração.');
    } catch (e) {
      if (e.status === 409) { setDenunciada(true); setMensagem('Já denunciou esta avaliação.'); }
      else setErro(e.message);
    } finally { setAEnviar(false); }
  }

  return <article className="avaliacao-publica" data-testid={`avaliacao-${avaliacao._id}`}>
    <header className="avaliacao-publica__cabecalho"><span className="avaliacao-publica__avatar" aria-hidden="true">{(avaliacao.autor?.nome || 'Comprador').charAt(0)}</span>
      <div><h3>{avaliacao.autor?.nome || 'Comprador'}</h3>{data && !Number.isNaN(data.getTime()) && <time dateTime={data.toISOString()}>{data.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}</time>}</div>
    </header>
    <div className="avaliacao-publica__estrelas"><span aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={15} fill={i < avaliacao.classificacao ? 'currentColor' : 'none'} />)}</span><span>{avaliacao.classificacao}/5</span></div>
    {avaliacao.comentario && <p className="avaliacao-publica__comentario">{avaliacao.comentario}</p>}
    {token ? <button type="button" className="avaliacao-publica__denunciar"
      disabled={aEnviar || denunciada} aria-busy={aEnviar} onClick={denunciar}>
      <Flag size={14} aria-hidden="true" />{denunciada ? 'Denúncia enviada' : aEnviar ? 'A enviar…' : 'Denunciar avaliação'}
    </button> : <Link to="/login" state={{ de: location.pathname }} className="avaliacao-publica__denunciar">Entrar para denunciar</Link>}
    {mensagem && <p role="status" className="text-success mt-2 mb-0">{mensagem}</p>}
    {erro && <p role="alert" className="text-danger mt-2 mb-0">{erro}</p>}
  </article>;
}

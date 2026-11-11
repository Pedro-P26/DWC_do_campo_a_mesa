import { Link } from 'react-router-dom';
import { useNotificacoes } from '../hooks/useNotificacoes.js';
export default function Notificacoes() {
  const { notificacoes, remover, marcarLida } = useNotificacoes();
  return <div className="notificacoes position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1100 }} aria-live="polite">
    {notificacoes.map(n => <div key={n.id} className="toast show mb-2" role="status">
      <div className="toast-header"><strong className="me-auto">Do Campo à Mesa</strong><button className="btn-close" aria-label="Fechar notificação" onClick={() => remover(n.id)} /></div>
      <div className="toast-body">{n.texto} <Link to={n.destino} onClick={() => { marcarLida(n.id); remover(n.id); }}>Ver</Link></div>
    </div>)}
  </div>;
}

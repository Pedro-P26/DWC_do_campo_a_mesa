import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotificacoes } from '../hooks/useNotificacoes.js';

export default function CentroNotificacoes() {
  const { utilizador } = useAuth();
  const { historico, porLer, marcarLida, marcarTodasLidas } = useNotificacoes();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef(null);
  const botao = useRef(null);
  const titulo = useRef(null);
  const id = useId();
  const location = useLocation();

  useEffect(() => { setAberto(false); }, [location.pathname]);
  useEffect(() => {
    if (!aberto) return;
    titulo.current?.focus();
    function fora(evento) {
      if (!raiz.current?.contains(evento.target)) setAberto(false);
    }
    function teclado(evento) {
      if (evento.key === 'Escape') {
        setAberto(false);
        botao.current?.focus();
      }
    }
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', teclado);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', teclado);
    };
  }, [aberto]);

  if (!utilizador) return null;
  return <div className="centro-notificacoes" ref={raiz}>
    <button type="button" className="centro-notificacoes__sino" ref={botao}
      aria-label={porLer ? `Notificações, ${porLer} por ler` : 'Notificações'}
      aria-expanded={aberto} aria-controls={id} aria-haspopup="dialog"
      onClick={() => setAberto(!aberto)}>
      <Bell size={21} aria-hidden="true" />
      {porLer > 0 && <span className="centro-notificacoes__contador" aria-hidden="true">{porLer > 9 ? '9+' : porLer}</span>}
    </button>
    {aberto && <section id={id} role="dialog" aria-labelledby={id + '-titulo'} className="centro-notificacoes__painel">
      <div className="centro-notificacoes__cabecalho">
        <h2 id={id + '-titulo'} ref={titulo} tabIndex={-1}>Notificações</h2>
        <button type="button" aria-label="Fechar lista de notificações"
          onClick={() => { setAberto(false); botao.current?.focus(); }}><X size={19} aria-hidden="true" /></button>
      </div>
      {porLer > 0 && <button type="button" className="centro-notificacoes__marcar" onClick={marcarTodasLidas}>
        <CheckCheck size={16} aria-hidden="true" /> Marcar todas como lidas
      </button>}
      {historico.length === 0 ? <div className="centro-notificacoes__vazio"><Bell size={28} aria-hidden="true" /><p>Ainda não recebeu notificações.</p></div> :
        <ul className="centro-notificacoes__lista">
          {historico.map(n => <li key={n.id} className={n.lida ? '' : 'por-ler'}>
            <Link to={n.destino} onClick={() => { marcarLida(n.id); setAberto(false); }}>
              <span className="centro-notificacoes__texto">{n.texto}</span>
              <time dateTime={new Date(n.criadaEm).toISOString()}>
                {new Date(n.criadaEm).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
              </time>
              {!n.lida && <span className="centro-notificacoes__estado">Por ler</span>}
            </Link>
          </li>)}
        </ul>}
    </section>}
  </div>;
}

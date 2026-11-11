import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useEventoSocket } from './SocketContext.jsx';
import { useAuth } from './AuthContext.jsx';

const NotificacoesContext = createContext(null);
const LIMITE = 50;

function lerHistorico(utilizadorId) {
  if (!utilizadorId) return [];
  try {
    const dados = JSON.parse(localStorage.getItem('notificacoes:' + utilizadorId));
    if (!Array.isArray(dados)) return [];
    return dados.filter(n => typeof n?.id === 'string' && typeof n.texto === 'string' &&
      ['/encomendas', '/produtor'].includes(n.destino) && Number.isFinite(n.criadaEm) &&
      Number.isFinite(new Date(n.criadaEm).getTime()))
      .slice(0, LIMITE).map(n => ({ ...n, lida: n.lida === true }));
  } catch { return []; }
}

export function NotificacoesProvider({ children }) {
  const { utilizador } = useAuth();
  const utilizadorId = utilizador?.id || utilizador?._id;
  return <EstadoNotificacoes key={utilizadorId || 'visitante'} utilizadorId={utilizadorId}>
    {children}
  </EstadoNotificacoes>;
}

function EstadoNotificacoes({ utilizadorId, children }) {
  const { atualizar } = useAuth();
  const [historico, setHistorico] = useState(() => lerHistorico(utilizadorId));
  const [notificacoes, setNotificacoes] = useState([]);
  const timers = useRef(new Set());

  useEffect(() => {
    if (!utilizadorId) return;
    try { localStorage.setItem('notificacoes:' + utilizadorId, JSON.stringify(historico)); }
    catch { /* O histórico continua disponível nesta sessão. */ }
  }, [historico, utilizadorId]);
  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  const remover = useCallback(id => setNotificacoes(lista => lista.filter(n => n.id !== id)), []);
  const marcarLida = useCallback(id => {
    setHistorico(lista => lista.map(n => n.id === id ? { ...n, lida: true } : n));
  }, []);
  const marcarTodasLidas = useCallback(() => {
    setHistorico(lista => lista.map(n => ({ ...n, lida: true })));
  }, []);
  const mostrar = useCallback((texto, destino) => {
    if (!utilizadorId) return;
    const aviso = { id: crypto.randomUUID(), texto, destino, criadaEm: Date.now(), lida: false };
    setHistorico(lista => [aviso, ...lista].slice(0, LIMITE));
    setNotificacoes(lista => [...lista.slice(-4), aviso]);
    const timer = setTimeout(() => {
      remover(aviso.id);
      timers.current.delete(timer);
    }, 12000);
    timers.current.add(timer);
  }, [remover, utilizadorId]);

  useEventoSocket('encomenda-atualizada', useCallback(e => mostrar(
    `${e.produtor || 'O produtor'} marcou a sua encomenda como "${e.estado}".`, '/encomendas'), [mostrar]));
  useEventoSocket('nova-encomenda', useCallback(() => mostrar('Recebeu uma nova encomenda.', '/produtor'), [mostrar]));
  useEventoSocket('leilao-ganho', useCallback(e => mostrar(`Ganhou o leilão: ${e.lote}.`, '/encomendas'), [mostrar]));
  useEventoSocket('leilao-terminado', useCallback(e => mostrar(`Terminou o leilão: ${e.lote}.`, '/produtor'), [mostrar]));
  useEventoSocket('conta-validada', useCallback(() => {
    mostrar('A sua conta de produtor foi validada.', '/produtor');
    atualizar().catch(() => {});
  }, [mostrar, atualizar]));
  useEventoSocket('connect', useCallback(() => { atualizar().catch(() => {}); }, [atualizar]));

  return <NotificacoesContext.Provider value={{
    notificacoes, historico, remover, marcarLida, marcarTodasLidas,
    porLer: historico.filter(n => !n.lida).length
  }}>{children}</NotificacoesContext.Provider>;
}

export const useNotificacoes = () => useContext(NotificacoesContext);

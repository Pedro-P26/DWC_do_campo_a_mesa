import { useCallback, useEffect, useRef, useState } from 'react';
import { useEventoSocket } from '../context/SocketContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
export function useNotificacoes() {
  const [notificacoes, setNotificacoes] = useState([]); const timers = useRef(new Set());
  const { token, atualizar } = useAuth();
  const remover = useCallback(id => setNotificacoes(ns => ns.filter(n => n.id !== id)), []);
  const mostrar = useCallback((texto, destino) => {
    const id = crypto.randomUUID(); setNotificacoes(ns => [...ns.slice(-4), { id, texto, destino }]);
    const t = setTimeout(() => { remover(id); timers.current.delete(t); }, 12000); timers.current.add(t);
  }, [remover]);
  useEffect(() => { setNotificacoes([]); return () => { timers.current.forEach(clearTimeout); timers.current.clear(); }; }, [token]);
  useEventoSocket('encomenda-atualizada', useCallback(e => mostrar(`${e.produtor || 'O produtor'} marcou a sua encomenda como "${e.estado}".`, '/encomendas'), [mostrar]));
  useEventoSocket('nova-encomenda', useCallback(() => mostrar('Recebeu uma nova encomenda.', '/produtor'), [mostrar]));
  useEventoSocket('leilao-ganho', useCallback(e => mostrar(`Ganhou o leilão: ${e.lote}.`, '/encomendas'), [mostrar]));
  useEventoSocket('leilao-terminado', useCallback(e => mostrar(`Terminou o leilão: ${e.lote}.`, '/produtor'), [mostrar]));
  useEventoSocket('conta-validada', useCallback(() => { mostrar('A sua conta de produtor foi validada.', '/produtor'); atualizar().catch(() => {}); }, [mostrar, atualizar]));
  useEventoSocket('connect', useCallback(() => { atualizar().catch(() => {}); }, [atualizar]));
  return { notificacoes, remover };
}

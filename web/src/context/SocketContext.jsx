import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';
const SocketContext = createContext(null);
export function SocketProvider({ children }) {
  const { token, aValidar, sair } = useAuth();
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    if (!token || aValidar) { setSocket(null); return; }
    const s = io(API_URL, { auth: { token } });
    s.on('connect_error', err => { if (err.message === 'não autorizado') sair(); });
    setSocket(s);
    return () => s.disconnect();
  }, [token, aValidar, sair]);
  const ativo = socket?.auth?.token === token && !aValidar ? socket : null;
  return <SocketContext.Provider value={ativo}>{children}</SocketContext.Provider>;
}
export const useSocket = () => useContext(SocketContext);
export function useEventoSocket(evento, handler) {
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    socket.on(evento, handler);
    return () => socket.off(evento, handler);
  }, [socket, evento, handler]);
}

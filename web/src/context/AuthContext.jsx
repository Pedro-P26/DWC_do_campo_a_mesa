import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('sessao')); return s?.token && s?.utilizador ? s : null; } catch { return null; }
  });
  const [aValidar, setAValidar] = useState(() => !!sessao?.token);
  const token = sessao?.token;
  const sair = useCallback(() => { localStorage.removeItem('sessao'); setSessao(null); setAValidar(false); }, []);
  const guardarSessao = useCallback(nova => { localStorage.setItem('sessao', JSON.stringify(nova)); setSessao(nova); }, []);
  async function entrar(email, password) {
    const nova = await api('/auth/login', { metodo: 'POST', corpo: { email, password } });
    guardarSessao(nova); return nova.utilizador;
  }
  async function registar(corpo) {
    const nova = await api('/auth/registo', { metodo: 'POST', corpo });
    guardarSessao(nova); return nova.utilizador;
  }
  const atualizar = useCallback(async signal => {
    if (!token) return;
    const utilizador = await api('/auth/eu', { token, signal });
    if (!signal?.aborted) setSessao(atual => {
      if (atual?.token !== token) return atual;
      const nova = { ...atual, utilizador };
      localStorage.setItem('sessao', JSON.stringify(nova)); return nova;
    });
    return utilizador;
  }, [token]);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setAValidar(true);
    atualizar(controller.signal).catch(err => {
      if (!controller.signal.aborted && [401, 404].includes(err.status)) sair();
    }).finally(() => { if (!controller.signal.aborted) setAValidar(false); });
    const invalidar = evento => { if (evento.detail === token) sair(); };
    window.addEventListener('sessao-invalida', invalidar);
    // A assinatura e a validade sao verificadas pelo servidor; esta leitura so agenda a expiracao.
    let timer;
    try {
      const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (typeof p.exp === 'number') timer = setTimeout(sair, Math.max(0, Math.min(p.exp * 1000 - Date.now(), 2147483647)));
    } catch { /* /auth/eu rejeita tokens malformados. */ }
    return () => { controller.abort(); clearTimeout(timer); window.removeEventListener('sessao-invalida', invalidar); };
  }, [token, atualizar, sair]);
  return <AuthContext.Provider value={{ utilizador: sessao?.utilizador || null, token: token || null,
    aValidar, entrar, registar, sair, guardarSessao, atualizar }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

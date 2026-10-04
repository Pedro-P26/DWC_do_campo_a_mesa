import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export function useApi(caminho) {
  const { token } = useAuth();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [aCarregar, setACarregar] = useState(Boolean(caminho));
  const pedido = useRef(null);

  const recarregar = useCallback(async () => {
    pedido.current?.abort();
    if (!caminho) {
      setDados(null);
      setErro('');
      setACarregar(false);
      return;
    }
    const controller = new AbortController();
    pedido.current = controller;
    setACarregar(true);
    setErro('');
    try {
      const resposta = await api(caminho, { token, signal: controller.signal });
      if (!controller.signal.aborted) setDados(resposta);
    } catch (err) {
      if (!controller.signal.aborted) setErro(err.message);
    } finally {
      if (!controller.signal.aborted) setACarregar(false);
    }
  }, [caminho, token]);

  useEffect(() => {
    recarregar();
    return () => pedido.current?.abort();
  }, [recarregar]);

  return { dados, erro, aCarregar, recarregar, setDados };
}

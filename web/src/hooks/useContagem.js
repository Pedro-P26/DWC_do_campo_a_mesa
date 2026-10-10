import { useEffect, useState } from 'react';
export function useContagem(ate, offset = 0) {
  const calcular = () => ate ? Math.max(0, new Date(ate).getTime() - (Date.now() + offset)) : 0;
  const [restante, setRestante] = useState(calcular);
  useEffect(() => {
    const calcularAgora = () => setRestante(ate ? Math.max(0, new Date(ate).getTime() - (Date.now() + offset)) : 0);
    calcularAgora(); const t = setInterval(calcularAgora, 1000); return () => clearInterval(t);
  }, [ate, offset]);
  return restante;
}
export function formatarTempo(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

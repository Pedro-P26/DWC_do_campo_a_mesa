import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { useContagem, formatarTempo } from '../hooks/useContagem.js';
import { USAR_DADOS_SIMULADOS } from '../api/client.js';

export default function LeilaoDestaque() {
  const { dados, erro, recarregar } = useApi(USAR_DADOS_SIMULADOS ? null : '/auctions?estado=ativo');
  useEffect(() => {
    if (USAR_DADOS_SIMULADOS) return;
    const timer = setInterval(recarregar, 15000);
    return () => clearInterval(timer);
  }, [recarregar]);
  const leilao = dados?.filter(l => new Date(l.iniciaEm) <= new Date() && new Date(l.terminaEm) > new Date())
    .sort((a, b) => new Date(a.terminaEm) - new Date(b.terminaEm))[0];
  const restante = useContagem(leilao?.terminaEm);
  if (!leilao || erro || restante <= 0) return null;
  return <section aria-label="Leilão em direto" className="card p-3 mt-3 border-success">
    <p className="text-success fw-bold mb-1">Leilão em direto · {formatarTempo(restante)}</p>
    <h2 className="h4">{leilao.lote}</h2>
    <p>{leilao.produtor?.nome} · Licitação atual: {leilao.licitacaoAtual.valor.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</p>
    <Link to={`/leiloes/${leilao._id}`} className="btn btn-outline-success align-self-start">Ver leilão em direto</Link>
  </section>;
}

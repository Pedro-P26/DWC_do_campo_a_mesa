import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock3, Gavel } from 'lucide-react';
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
  return <section aria-label="Leilão em direto" className="leilao-destaque">
    <div className="leilao-destaque__lote">
      <span className="leilao-destaque__direto"><span aria-hidden="true" /> Leilão em direto</span>
      <h2>{leilao.lote}</h2>
      <p className="leilao-destaque__produtor"><Gavel size={16} aria-hidden="true" />
        {leilao.produtor?.produtor?.nomeExploracao || leilao.produtor?.nome}
      </p>
    </div>
    <div className="leilao-destaque__dados">
      <div>
        <span className="leilao-destaque__legenda">Licitação atual</span>
        <strong className="leilao-destaque__valor">{(leilao.licitacaoAtual?.valor ?? leilao.precoBase).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}</strong>
      </div>
      <div className="leilao-destaque__tempo">
        <span className="leilao-destaque__legenda"><Clock3 size={14} aria-hidden="true" /> Termina em</span>
        <strong className="leilao-destaque__valor" data-testid="destaque-tempo">{formatarTempo(restante)}</strong>
      </div>
    </div>
    <Link to={`/leiloes/${leilao._id}`} className="leilao-destaque__acao">
      Ver leilão em direto <ArrowUpRight size={19} aria-hidden="true" />
    </Link>
  </section>;
}

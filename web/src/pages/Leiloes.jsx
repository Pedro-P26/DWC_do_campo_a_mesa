import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Gavel } from 'lucide-react';
import { useApi } from '../hooks/useApi.js';

const euros = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

function tempoRestante(terminaEm, agora) {
  const segundos = Math.max(0, Math.ceil((new Date(terminaEm).getTime() - agora) / 1000));
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = segundos % 60;
  return `${dias ? `${dias} d ` : ''}${horas ? `${horas} h ` : ''}${minutos} min ${resto} s`;
}

export default function Leiloes() {
  const { dados, erro, aCarregar, recarregar } = useApi('/auctions?estado=ativo');
  const [agora, setAgora] = useState(Date.now);

  useEffect(() => {
    const intervalo = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  const leiloes = (dados || []).filter(leilao => new Date(leilao.terminaEm).getTime() > agora);

  return (
    <>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div>
          <h1>Leilões</h1>
          <p className="texto-secundario mb-0">Descubra os lotes dos produtores locais e participe nos leilões ativos.</p>
        </div>
        <button type="button" className="btn btn-outline-success" onClick={recarregar} disabled={aCarregar}>
          Atualizar leilões
        </button>
      </div>

      {erro && (
        <div className="alert alert-danger" role="alert">
          <p>Não foi possível carregar os leilões: {erro}</p>
          <button type="button" className="btn btn-outline-danger" onClick={recarregar} disabled={aCarregar}>Tentar novamente</button>
        </div>
      )}
      {aCarregar && <p className="texto-secundario" role="status">A carregar leilões…</p>}

      {!aCarregar && !erro && (
        <>
          <p className="texto-secundario" role="status">
            {leiloes.length} {leiloes.length === 1 ? 'leilão ativo' : 'leilões ativos'}
          </p>
          {leiloes.length === 0 ? (
            <div className="card p-4">
              <p>De momento não há leilões ativos. Volte mais tarde para descobrir novos lotes.</p>
              <Link to="/">Explorar o catálogo</Link>
            </div>
          ) : (
            <section className="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-4" aria-label="Leilões ativos">
              {leiloes.map(leilao => (
                <div className="col" key={leilao._id}>
                  <article className="card h-100">
                    <div className="card-body d-flex flex-column">
                      <span className="text-success small d-flex align-items-center gap-2 mb-2">
                        <Gavel size={16} aria-hidden="true" /> Leilão ativo
                      </span>
                      <h2 className="h5">{leilao.lote}</h2>
                      {leilao.produtor?._id && (
                        <Link to={`/produtores/${leilao.produtor._id}`} className="small mb-3">
                          {leilao.produtor.produtor?.nomeExploracao || leilao.produtor.nome}
                        </Link>
                      )}
                      {leilao.quantidade && <p className="small texto-secundario">Quantidade: {leilao.quantidade}</p>}
                      <p className="small texto-secundario mb-1">Licitação atual</p>
                      <p className="fs-4 fw-bold mb-3">{euros.format(leilao.licitacaoAtual?.valor ?? leilao.precoBase)}</p>
                      <p className="small d-flex align-items-center gap-2">
                        <Clock size={16} aria-hidden="true" />
                        <span>Tempo restante: {tempoRestante(leilao.terminaEm, agora)}</span>
                      </p>
                      <Link to={`/leiloes/${leilao._id}`} className="btn btn-success mt-auto">Entrar na sala</Link>
                    </div>
                  </article>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}

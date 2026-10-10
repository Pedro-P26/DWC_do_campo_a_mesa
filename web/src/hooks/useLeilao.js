import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
export function useLeilao(id) {
  const socket = useSocket();
  const [leilao, setLeilao] = useState(null);
  const [licitacoes, setLicitacoes] = useState([]);
  const [participantes, setParticipantes] = useState(0);
  const [offset, setOffset] = useState(0);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [aLicitar, setALicitar] = useState(false);
  const [ligado, setLigado] = useState(false);
  useEffect(() => {
    setLeilao(null); setLicitacoes([]); setResultado(null); setErro('');
    if (!socket) return;
    const entrar = () => { setLigado(true); socket.emit('entrar', id); };
    const desligar = () => { setLigado(false); setALicitar(false); };
    const estado = ({ agora, leilao: l, licitacoes: ls }) => {
      if (l._id !== id) return;
      setOffset(new Date(agora).getTime() - Date.now()); setLeilao(l); setLicitacoes(ls); setErro('');
      if (l.estado === 'terminado') setResultado({ vencedor: l.licitacaoAtual?.comprador ? { id: l.licitacaoAtual.comprador, nome: l.licitacaoAtual.nome } : null, valor: l.licitacaoAtual?.valor });
    };
    const nova = b => {
      if (b.leilaoId !== id) return;
      setLeilao(l => l && ({ ...l, licitacaoAtual: { valor: b.valor, comprador: b.comprador, nome: b.nome, em: b.createdAt }, numLicitacoes: b.numLicitacoes }));
      setLicitacoes(ls => [b, ...ls.filter(x => x._id !== b._id)].slice(0, 20));
    };
    const fim = r => { if (r.id !== id) return; setResultado(r); setLeilao(l => l && ({ ...l, estado: 'terminado' })); };
    const aberto = r => { if (r.id === id) entrar(); };
    const handlers = { connect: entrar, disconnect: desligar, estado, 'nova-licitacao': nova, presenca: setParticipantes, recusada: setErro, terminado: fim, aberto };
    Object.entries(handlers).forEach(([e, h]) => socket.on(e, h));
    if (socket.connected) entrar();
    return () => { Object.entries(handlers).forEach(([e, h]) => socket.off(e, h)); socket.emit('sair', id); };
  }, [socket, id]);
  function licitar(valor) {
    if (!socket?.connected || aLicitar) return;
    setErro(''); setALicitar(true);
    socket.timeout(8000).emit('licitar', { leilaoId: id, valor }, (err, r) => {
      setALicitar(false);
      if (err) setErro('Sem confirmação. Aguarde a atualização da sala antes de voltar a licitar.');
      else if (!r.ok) setErro(r.erro);
    });
  }
  return { leilao, atual: leilao?.licitacaoAtual, licitacoes, participantes, offset, resultado, erro, aLicitar, ligado, licitar };
}

// Linha temporal do estado da encomenda: pendente -> confirmada -> pronta -> entregue
import { Check } from 'lucide-react';
const ESTADOS = [
  { valor: 'pendente', titulo: 'Pendente', descricao: 'Pedido recebido' },
  { valor: 'confirmada', titulo: 'Confirmada', descricao: 'Em preparação' },
  { valor: 'pronta', titulo: 'Pronta', descricao: 'Preparação concluída' },
  { valor: 'entregue', titulo: 'Entregue', descricao: 'Compra concluída' }
];

export default function EstadoEncomenda({ estado }) {
  const indice = ESTADOS.findIndex(e => e.valor === estado);
  const concluida = estado === 'entregue';
  return (
    <ol className={`estado-encomenda${concluida ? ' estado-encomenda--concluida' : ''}`} aria-label={`Estado: ${estado}`}>
      {ESTADOS.map((e, i) => (
        <li key={e.valor} className={i < indice ? 'feito' : i === indice ? 'atual' : ''} aria-current={i === indice ? 'step' : undefined}>
          <span className="estado-encomenda__marcador" aria-hidden="true">{i < indice || concluida ? <Check size={18} strokeWidth={2.5} /> : i + 1}</span>
          <span className="estado-encomenda__titulo">{e.titulo}</span>
          <small className="estado-encomenda__descricao">{e.descricao}</small>
          {i < indice && <span className="visually-hidden">Concluído</span>}
        </li>
      ))}
    </ol>
  );
}

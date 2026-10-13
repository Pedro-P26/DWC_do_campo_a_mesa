import { Link, useLocation } from 'react-router-dom';
import { Gavel, LayoutDashboard, ShieldCheck, ShoppingBasket, ShoppingBag, Sprout, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';

const PRODUTOS = { destino: '/', rotulo: 'Produtos', icone: Sprout, grupo: 'produtos' };
const LEILOES = { destino: '/leiloes', rotulo: 'Leilões', icone: Gavel };
const PERFIL = { destino: '/perfil', rotulo: 'Perfil', icone: UserRound, grupo: 'perfil' };
const OPCOES = {
  visitante: [LEILOES, PRODUTOS, PERFIL],
  comprador: [LEILOES,
    { destino: '/carrinho', rotulo: 'Carrinho', icone: ShoppingBasket },
    PRODUTOS,
    { destino: '/encomendas', rotulo: 'Encomendas', icone: ShoppingBag }, PERFIL],
  produtor: [{ destino: '/produtor', rotulo: 'Painel', icone: LayoutDashboard }, PRODUTOS, LEILOES, PERFIL],
  admin: [{ destino: '/admin', rotulo: 'Admin', nome: 'Administração', icone: ShieldCheck }, PRODUTOS, LEILOES, PERFIL]
};

function estaAtivo(opcao, caminho) {
  if (opcao.grupo === 'produtos') return caminho === '/' || caminho.startsWith('/produtos/') || caminho.startsWith('/produtores/');
  if (opcao.grupo === 'perfil') return ['/perfil', '/login', '/registo'].includes(caminho);
  return caminho === opcao.destino || caminho.startsWith(`${opcao.destino}/`);
}

export default function BarraMobile() {
  const { utilizador } = useAuth();
  const { linhas } = useCarrinho();
  const location = useLocation();
  const opcoes = OPCOES[utilizador?.papel] || OPCOES.visitante;

  return (
    <nav className="barra-mobile" aria-label="Navegação móvel">
      <ul className="barra-mobile__lista" style={{ '--numero-opcoes': opcoes.length }}>
        {opcoes.map(opcao => {
          const Icone = opcao.icone;
          const inicio = opcao.grupo === 'produtos';
          const ativo = estaAtivo(opcao, location.pathname);
          const artigos = opcao.destino === '/carrinho' ? linhas.length : 0;
          return <li key={opcao.destino}>
            <Link to={opcao.destino} className={`barra-mobile__ligacao${inicio ? ' barra-mobile__ligacao--inicio' : ''}${ativo ? ' ativa' : ''}`}
              aria-current={ativo ? 'page' : undefined}
              aria-label={artigos ? `Carrinho, ${artigos} ${artigos === 1 ? 'produto' : 'produtos'}` : opcao.nome || opcao.rotulo}
              state={opcao.grupo === 'perfil' && location.state?.de ? { de: location.state.de } : undefined}>
              <span className="barra-mobile__icone">
                <Icone size={inicio ? 25 : 23} strokeWidth={ativo ? 2 : 1.7} aria-hidden="true" />
                {artigos > 0 && <span className="barra-mobile__contador" aria-hidden="true">{artigos > 99 ? '99+' : artigos}</span>}
              </span>
              <span className="barra-mobile__rotulo">{opcao.rotulo}</span>
            </Link>
          </li>;
        })}
      </ul>
    </nav>
  );
}

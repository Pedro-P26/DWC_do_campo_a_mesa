import { Link, NavLink } from 'react-router-dom';
import { Leaf, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';
import CentroNotificacoes from './CentroNotificacoes.jsx';

export default function Navbar() {
  const { utilizador } = useAuth();
  const { linhas } = useCarrinho();
  const inicial = utilizador?.nome?.trim().charAt(0).toLocaleUpperCase('pt-PT');

  return (
    <header className="barra-topo">
      <nav className="navbar navbar-expand-lg container-xl" aria-label="Navegação principal">
        <Link to="/" className="navbar-brand marca"><span className="marca__simbolo"><Leaf size={23} strokeWidth={1.7} aria-hidden="true" /></span>Do Campo à Mesa</Link>
        <div className="navbar-collapse d-none d-lg-flex">
          <ul className="navbar-nav mx-lg-auto">
            <li className="nav-item"><NavLink to="/" end className="nav-link">Produtos</NavLink></li>
            <li className="nav-item"><NavLink to="/leiloes" className="nav-link">Leilões</NavLink></li>
            {utilizador?.papel === 'comprador' && (
              <li className="nav-item"><NavLink to="/encomendas" className="nav-link">Encomendas</NavLink></li>
            )}
            {utilizador?.papel === 'produtor' && (
              <li className="nav-item"><NavLink to="/produtor" className="nav-link">Painel</NavLink></li>
            )}
            {utilizador?.papel === 'admin' && (
              <li className="nav-item"><NavLink to="/admin" className="nav-link">Administração</NavLink></li>
            )}
          </ul>
          <div className="barra-topo__acoes">
            {utilizador?.papel === 'comprador' && (
              <NavLink to="/carrinho" className="barra-topo__carrinho">Carrinho ({linhas.length})</NavLink>
            )}
            <NavLink to="/perfil" className="barra-topo__perfil" aria-label="Perfil">
              <span className="barra-topo__avatar" aria-hidden="true">{inicial || <UserRound size={17} />}</span>
              <span>Perfil</span>
            </NavLink>
          </div>
        </div>
        <CentroNotificacoes />
      </nav>
    </header>
  );
}

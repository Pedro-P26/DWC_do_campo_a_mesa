import { Link, NavLink } from 'react-router-dom';
import { Leaf, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCarrinho } from '../context/CarrinhoContext.jsx';

export default function Navbar() {
  const { utilizador } = useAuth();
  const { linhas } = useCarrinho();

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
          <div className="d-flex gap-2 align-items-center">
            {utilizador?.papel === 'comprador' && (
              <Link to="/carrinho" className="btn btn-outline-secondary">Carrinho ({linhas.length})</Link>
            )}
            <NavLink to="/perfil" className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"><UserRound size={17} aria-hidden="true" /> Perfil</NavLink>
          </div>
        </div>
      </nav>
    </header>
  );
}

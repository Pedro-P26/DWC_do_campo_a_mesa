import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, Clock3, LayoutDashboard, LogIn, LogOut, ShoppingBag, UserPlus, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const PAPEIS = { comprador: 'Comprador', produtor: 'Produtor', admin: 'Administrador' };

export default function Perfil() {
  const { utilizador, aValidar, sair } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const destino = location.state?.de || '/perfil';

  if (aValidar) return <p role="status">A carregar o perfil…</p>;

  if (!utilizador) return (
    <section className="perfil" aria-labelledby="titulo-perfil">
      <div className="perfil__identidade">
        <span className="perfil__avatar" aria-hidden="true"><UserRound size={30} /></span>
        <div><h1 id="titulo-perfil">Perfil</h1><p className="texto-secundario mb-0">A sua conta Do Campo à Mesa</p></div>
      </div>
      <div className="perfil__acoes">
        <Link to="/login" state={{ de: destino }} className="btn btn-success"><LogIn size={18} aria-hidden="true" /> Entrar</Link>
        <Link to="/registo" state={{ de: destino }} className="btn btn-outline-success"><UserPlus size={18} aria-hidden="true" /> Criar conta</Link>
      </div>
    </section>
  );

  const produtor = utilizador.papel === 'produtor';
  const aprovado = utilizador.produtor?.validado;
  const painel = utilizador.papel === 'admin' ? '/admin' : '/produtor';

  return (
    <section className="perfil" aria-labelledby="titulo-perfil">
      <div className="perfil__identidade">
        <span className="perfil__avatar" aria-hidden="true"><UserRound size={30} /></span>
        <div><h1 id="titulo-perfil">Perfil</h1><p className="texto-secundario mb-0">{PAPEIS[utilizador.papel]}</p></div>
      </div>
      <dl className="perfil__dados">
        <div><dt>Nome</dt><dd>{utilizador.nome}</dd></div>
        <div><dt>Email</dt><dd>{utilizador.email}</dd></div>
        {produtor && <>
          <div><dt>Exploração</dt><dd>{utilizador.produtor?.nomeExploracao || utilizador.nome}</dd></div>
          {utilizador.produtor?.localidade && <div><dt>Localidade</dt><dd>{utilizador.produtor.localidade}</dd></div>}
          <div><dt>Estado da conta</dt><dd>
            <span className={`perfil__estado${aprovado ? ' aprovado' : ''}`}>
              {aprovado ? <BadgeCheck size={17} aria-hidden="true" /> : <Clock3 size={17} aria-hidden="true" />}
              {aprovado ? 'Aprovado' : 'A aguardar aprovação'}
            </span>
          </dd></div>
        </>}
      </dl>
      {produtor && !aprovado && <p className="alert alert-warning">A conta precisa de aprovação para criar produtos e leilões.</p>}
      <div className="perfil__acoes">
        {utilizador.papel === 'comprador' ? (
          <Link to="/encomendas" className="btn btn-outline-success"><ShoppingBag size={18} aria-hidden="true" /> As minhas encomendas</Link>
        ) : (
          <Link to={painel} className="btn btn-outline-success"><LayoutDashboard size={18} aria-hidden="true" /> Abrir {produtor ? 'painel' : 'administração'}</Link>
        )}
        {produtor && aprovado && <Link to={`/produtores/${utilizador.id || utilizador._id}`} className="btn btn-outline-success">Página pública</Link>}
        <button type="button" className="btn btn-outline-secondary" onClick={() => { sair(); navigate('/perfil', { replace: true }); }}>
          <LogOut size={18} aria-hidden="true" /> Terminar sessão
        </button>
      </div>
    </section>
  );
}

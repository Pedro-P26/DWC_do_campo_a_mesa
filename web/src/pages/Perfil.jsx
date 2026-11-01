import { useId } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, BadgeCheck, Clock3, LayoutDashboard, LogIn, LogOut, Settings2, ShoppingBag, Sprout, Store, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const PAPEIS = { comprador: 'Comprador', produtor: 'Produtor', admin: 'Administrador' };

function AcessoPerfil({ to, icon: Icon, titulo, descricao }) {
  const id = useId();
  return (
    <Link to={to} className="conta-acesso" aria-labelledby={id} aria-describedby={id + '-descricao'}>
      <span className="conta-acesso__icone"><Icon size={20} aria-hidden="true" /></span>
      <span className="conta-acesso__texto"><strong id={id}>{titulo}</strong><small id={id + '-descricao'}>{descricao}</small></span>
      <ArrowUpRight size={18} aria-hidden="true" />
    </Link>
  );
}

export default function Perfil() {
  const { utilizador, aValidar, sair } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const destino = location.state?.de || '/perfil';

  if (aValidar) return <p role="status">A carregar o perfil…</p>;

  const produtor = utilizador?.papel === 'produtor';
  const aprovado = utilizador?.produtor?.validado;
  const rejeitado = utilizador?.produtor?.rejeitado;
  const nomes = utilizador?.nome?.trim().split(/\s+/) || [];
  const iniciais = [nomes[0]?.[0], nomes.length > 1 ? nomes.at(-1)[0] : ''].join('').toUpperCase();

  return (
    <section className="conta-perfil" aria-labelledby="titulo-perfil">
      <header className="conta-perfil__cabecalho">
        <p className="conta-perfil__sobretitulo">DO CAMPO À MESA</p>
        <h1 id="titulo-perfil">Perfil</h1>
        <p>{utilizador ? 'Os seus dados e os acessos à sua área pessoal.' : 'Entre e faça parte do nosso mercado local.'}</p>
      </header>

      {!utilizador ? (
        <div className="conta-visitante">
          <span className="conta-visitante__icone"><Sprout size={38} aria-hidden="true" /></span>
          <h2>O seu lugar à mesa</h2>
          <p>Descubra produtores, acompanhe encomendas e participe nos leilões com a sua conta.</p>
          <div className="conta-visitante__acoes">
            <Link to="/login" state={{ de: destino }} className="btn btn-success"><LogIn size={18} aria-hidden="true" /> Entrar</Link>
            <Link to="/registo" state={{ de: destino }} className="btn btn-outline-success"><UserPlus size={18} aria-hidden="true" /> Criar conta</Link>
          </div>
        </div>
      ) : (
        <div className="conta-perfil__layout">
          <section className="conta-dados" aria-labelledby="titulo-dados-conta">
            <div className="conta-dados__cabecalho">
              <span className="conta-dados__avatar" aria-hidden="true">{iniciais}</span>
              <div><h2 id="titulo-dados-conta">Dados da conta</h2><span className="conta-dados__papel">{PAPEIS[utilizador.papel]}</span></div>
            </div>
            <dl className="conta-dados__lista">
              <div><dt>Nome</dt><dd>{utilizador.nome}</dd></div>
              <div><dt>Email</dt><dd>{utilizador.email}</dd></div>
              {produtor && <>
                <div><dt>Exploração</dt><dd>{utilizador.produtor?.nomeExploracao || utilizador.nome}</dd></div>
                <div><dt>Localidade</dt><dd>{utilizador.produtor?.localidade || 'Não indicada'}</dd></div>
              </>}
            </dl>
            {produtor && (
              <div className="conta-dados__validacao">
                <span className="conta-dados__legenda">Estado da conta</span>
                <span className={'conta-estado' + (aprovado ? ' conta-estado--aprovado' : '')}>
                  {aprovado ? <BadgeCheck size={16} aria-hidden="true" /> : <Clock3 size={16} aria-hidden="true" />}
                  {aprovado ? 'Aprovado' : rejeitado ? 'Registo rejeitado' : 'A aguardar aprovação'}
                </span>
                {!aprovado && <p>{rejeitado ? 'O registo de produtor foi rejeitado pela administração. A criação de produtos e leilões está indisponível.' : 'A conta precisa de aprovação para criar produtos e leilões.'}</p>}
              </div>
            )}
            <footer className="conta-dados__rodape">
              <button type="button" className="conta-sair" onClick={() => { sair(); navigate('/perfil', { replace: true }); }}>
                <LogOut size={17} aria-hidden="true" /> Terminar sessão
              </button>
            </footer>
          </section>

          <nav className="conta-acessos" aria-labelledby="titulo-acessos-conta">
            <h2 id="titulo-acessos-conta">Acessos rápidos</h2>
            <p>O que pretende fazer?</p>
            {utilizador.papel === 'comprador' ? (
              <AcessoPerfil to="/encomendas" icon={ShoppingBag} titulo="As minhas encomendas" descricao="Consulte os pedidos e acompanhe as entregas." />
            ) : (
              <AcessoPerfil to={utilizador.papel === 'admin' ? '/admin' : '/produtor'} icon={LayoutDashboard}
                titulo={produtor ? 'Abrir painel' : 'Abrir administração'}
                descricao={produtor ? 'Gerir produtos, encomendas e leilões.' : 'Aceder à gestão da plataforma.'} />
            )}
            {produtor && <AcessoPerfil to="/produtor/perfil" icon={Settings2} titulo="Editar página pública" descricao="Atualize a apresentação da sua exploração." />}
            {produtor && aprovado && <AcessoPerfil to={'/produtores/' + (utilizador.id || utilizador._id)} icon={Store}
              titulo="Página pública" descricao="Veja como a sua exploração aparece no mercado." />}
          </nav>
        </div>
      )}
    </section>
  );
}

import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Leaf, ShoppingBasket, Sprout } from 'lucide-react';

export default function PaginaAutenticacao({ registo = false, children }) {
  const location = useLocation();
  return <div className="pagina-autenticacao">
    <div className="autenticacao-layout">
      <aside className="autenticacao-apresentacao" aria-label="A nossa comunidade">
        <span className="autenticacao-apresentacao__simbolo"><Leaf size={38} strokeWidth={1.4} aria-hidden="true" /></span>
        <p className="pagina-sobretitulo">DO CAMPO À MESA</p>
        <h2>Mais perto da terra.<br />Mais perto de quem produz.</h2>
        <p>Encontre produtos locais e faça parte de uma comunidade que valoriza a origem de cada alimento.</p>
        <div className="autenticacao-apresentacao__origem"><Sprout size={22} aria-hidden="true" /><div><strong>Produtores da nossa região</strong><span>Conheça quem está por trás de cada produto.</span></div></div>
        <div className="autenticacao-apresentacao__origem"><ShoppingBasket size={22} aria-hidden="true" /><div><strong>Da exploração para a sua mesa</strong><span>Descubra o que a nossa terra tem para oferecer.</span></div></div>
        <Link to="/">Explorar os produtos <span aria-hidden="true">↗</span></Link>
      </aside>
      <div className="autenticacao-conteudo">
        <Link to="/perfil" state={location.state} className="autenticacao__voltar d-lg-none" aria-label="Voltar ao perfil" title="Voltar ao perfil">
          <ArrowLeft size={18} aria-hidden="true" /><span>Voltar ao perfil</span>
        </Link>
        <div className="autenticacao__cabecalho">
          <p className="pagina-sobretitulo">{registo ? 'JUNTE-SE À COMUNIDADE' : 'É BOM TER-VOS POR CÁ'}</p>
          <h1>{registo ? 'Registar' : 'Entrar'}</h1>
          <p>{registo ? 'Crie a sua conta e encontre o seu lugar à mesa.' : 'Aceda à sua conta e continue a descobrir o melhor da nossa terra.'}</p>
        </div>
        {children}
      </div>
    </div>
  </div>;
}

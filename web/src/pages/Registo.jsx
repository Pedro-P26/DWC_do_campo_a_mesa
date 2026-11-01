import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck, ShoppingBasket, Sprout } from 'lucide-react';
import PaginaAutenticacao from '../components/PaginaAutenticacao.jsx';
import CampoPassword from '../components/CampoPassword.jsx';
import { useAuth } from '../context/AuthContext.jsx';
export default function Registo() {
  const { registar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dados, setDados] = useState({ nome: '', email: '', password: '', papel: 'comprador', nomeExploracao: '', localidade: '' });
  const [erro, setErro] = useState('');
  const [aRegistar, setARegistar] = useState(false);
  const campo = e => setDados({ ...dados, [e.target.name]: e.target.value });
  async function submeter(e) {
    e.preventDefault(); if (aRegistar) return;
    setErro(''); setARegistar(true);
    try {
      const { nome, email, password, papel, nomeExploracao, localidade } = dados;
      const u = await registar({ nome, email, password, papel,
        ...(papel === 'produtor' ? { produtor: { nomeExploracao, localidade } } : {}) });
      navigate(location.state?.de || (u.papel === 'produtor' ? '/produtor' : '/'), { replace: true });
    } catch (err) { setErro(err.message); } finally { setARegistar(false); }
  }
  return <PaginaAutenticacao registo>
    <form className="autenticacao-formulario" onSubmit={submeter}>
      <fieldset disabled={aRegistar}>
        <div className="autenticacao-campo">
          <label className="form-label" htmlFor="nome">Nome</label>
          <input id="nome" name="nome" autoComplete="name" className="form-control" required maxLength={100} value={dados.nome} onChange={campo} />
        </div>
        <div className="autenticacao-campo">
          <label className="form-label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="username" className="form-control" required value={dados.email} onChange={campo} />
        </div>
        <CampoPassword value={dados.password} onChange={campo} disabled={aRegistar} nova />
        <div className="autenticacao-campo">
          <label className="form-label" htmlFor="papel">Tipo de conta</label>
          <select id="papel" name="papel" className="form-select" value={dados.papel} onChange={campo} aria-describedby="ajuda-tipo-conta">
            <option value="comprador">Comprador</option><option value="produtor">Produtor</option>
          </select>
          <p id="ajuda-tipo-conta" className="autenticacao-tipo">
            {dados.papel === 'produtor' ? <Sprout size={18} aria-hidden="true" /> : <ShoppingBasket size={18} aria-hidden="true" />}
            {dados.papel === 'produtor' ? 'Dê a conhecer a sua exploração e venda os seus produtos.' : 'Descubra produtos locais, faça encomendas e participe em leilões.'}
          </p>
        </div>
        {dados.papel === 'produtor' && <section className="autenticacao-exploracao" aria-labelledby="titulo-exploracao">
          <h2 id="titulo-exploracao">A sua exploração</h2>
          <div className="autenticacao-campo">
            <label className="form-label" htmlFor="nomeExploracao">Nome da exploração</label>
            <input id="nomeExploracao" name="nomeExploracao" className="form-control" required value={dados.nomeExploracao} onChange={campo} />
          </div>
          <div className="autenticacao-campo">
            <label className="form-label" htmlFor="localidade">Localidade</label>
            <input id="localidade" name="localidade" autoComplete="address-level2" className="form-control" required value={dados.localidade} onChange={campo} />
          </div>
          <p className="autenticacao-exploracao__nota"><ShieldCheck size={18} aria-hidden="true" />A conta de produtor precisa de aprovação do administrador para criar produtos e leilões.</p>
        </section>}
        {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
        <button className="btn btn-success autenticacao-submeter" type="submit">{aRegistar ? 'A registar…' : 'Registar'}<ArrowRight size={18} aria-hidden="true" /></button>
      </fieldset>
      <p className="autenticacao-alternar">Já tem conta? <Link to="/login" state={location.state}>Entrar</Link></p>
    </form>
  </PaginaAutenticacao>;
}

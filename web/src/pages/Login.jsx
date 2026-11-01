import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PaginaAutenticacao from '../components/PaginaAutenticacao.jsx';
import CampoPassword from '../components/CampoPassword.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const INICIO = { comprador: '/', produtor: '/produtor', admin: '/admin' };

export default function Login() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dados, setDados] = useState({ email: '', password: '' });
  const [erro, setErro] = useState('');
  const [aEntrar, setAEntrar] = useState(false);

  async function submeter(e) {
    e.preventDefault();
    if (aEntrar) return;
    setErro('');
    setAEntrar(true);
    try {
      const u = await entrar(dados.email, dados.password);
      navigate(location.state?.de || INICIO[u.papel] || '/', { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setAEntrar(false);
    }
  }

  return <PaginaAutenticacao>
    <form className="autenticacao-formulario" onSubmit={submeter}>
      <div className="autenticacao-campo">
        <label htmlFor="email" className="form-label">Email</label>
        <input id="email" type="email" autoComplete="username" className="form-control" required disabled={aEntrar}
          value={dados.email} onChange={e => setDados({ ...dados, email: e.target.value })} />
      </div>
      <CampoPassword value={dados.password} onChange={e => setDados({ ...dados, password: e.target.value })} disabled={aEntrar} />
      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      <button type="submit" className="btn btn-success autenticacao-submeter" disabled={aEntrar}>
        {aEntrar ? 'A entrar…' : 'Entrar'}<ArrowRight size={18} aria-hidden="true" />
      </button>
      <p className="autenticacao-alternar">Ainda não tem conta? <Link to="/registo" state={location.state}>Criar conta</Link></p>
    </form>
  </PaginaAutenticacao>;
}

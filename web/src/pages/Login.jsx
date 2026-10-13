import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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

  return (
    <form className="formulario-estreito" onSubmit={submeter}>
      <div className="autenticacao__cabecalho">
        <Link to="/perfil" state={location.state} className="autenticacao__voltar d-lg-none" aria-label="Voltar ao perfil" title="Voltar ao perfil">
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <h1>Entrar</h1>
      </div>
      <label htmlFor="email" className="form-label">Email</label>
      <input id="email" type="email" autoComplete="username" className="form-control mb-3" required disabled={aEntrar}
        value={dados.email} onChange={(e) => setDados({ ...dados, email: e.target.value })} />
      <label htmlFor="password" className="form-label">Password</label>
      <input id="password" type="password" autoComplete="current-password" className="form-control mb-3" required disabled={aEntrar}
        value={dados.password} onChange={(e) => setDados({ ...dados, password: e.target.value })} />
      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      <button type="submit" className="btn btn-success w-100" disabled={aEntrar}>
        {aEntrar ? 'A entrar…' : 'Entrar'}
      </button>
    </form>
  );
}

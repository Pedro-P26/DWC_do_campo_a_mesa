import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
export default function Registo() {
  const { registar } = useAuth();
  const navigate = useNavigate();
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
      navigate(u.papel === 'produtor' ? '/produtor' : '/', { replace: true });
    } catch (err) { setErro(err.message); } finally { setARegistar(false); }
  }
  return <form className="formulario-estreito" onSubmit={submeter}>
    <h1>Registar</h1>
    <fieldset disabled={aRegistar}>
      <label className="form-label" htmlFor="nome">Nome</label>
      <input id="nome" name="nome" autoComplete="name" className="form-control mb-3" required maxLength={100} value={dados.nome} onChange={campo} />
      <label className="form-label" htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="username" className="form-control mb-3" required value={dados.email} onChange={campo} />
      <label className="form-label" htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="new-password" className="form-control mb-3" required minLength={8} maxLength={72} value={dados.password} onChange={campo} />
      <label className="form-label" htmlFor="papel">Tipo de conta</label>
      <select id="papel" name="papel" className="form-select mb-3" value={dados.papel} onChange={campo}>
        <option value="comprador">Comprador</option><option value="produtor">Produtor</option>
      </select>
      {dados.papel === 'produtor' && <>
        <label className="form-label" htmlFor="nomeExploracao">Nome da exploração</label>
        <input id="nomeExploracao" name="nomeExploracao" className="form-control mb-3" required value={dados.nomeExploracao} onChange={campo} />
        <label className="form-label" htmlFor="localidade">Localidade</label>
        <input id="localidade" name="localidade" className="form-control mb-3" required value={dados.localidade} onChange={campo} />
        <p>A conta de produtor precisa de aprovação do administrador para criar produtos e leilões.</p>
      </>}
      {erro && <div className="alert alert-danger" role="alert">{erro}</div>}
      <button className="btn btn-success w-100" type="submit">{aRegistar ? 'A registar…' : 'Registar'}</button>
    </fieldset>
  </form>;
}

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function CampoPassword({ value, onChange, disabled, nova = false }) {
  const [mostrar, setMostrar] = useState(false);
  return <div className="autenticacao-campo">
    <label htmlFor="password" className="form-label">Password</label>
    <div className="autenticacao-password">
      <input id="password" name="password" type={mostrar ? 'text' : 'password'} className="form-control"
        autoComplete={nova ? 'new-password' : 'current-password'} required disabled={disabled}
        minLength={nova ? 8 : undefined} maxLength={nova ? 72 : undefined}
        aria-describedby={nova ? 'ajuda-password' : undefined} value={value} onChange={onChange} />
      <button type="button" aria-label={mostrar ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
        aria-pressed={mostrar} disabled={disabled} onClick={() => setMostrar(!mostrar)}>
        {mostrar ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
      </button>
    </div>
    {nova && <p id="ajuda-password" className="autenticacao-ajuda">Utilize entre 8 e 72 caracteres.</p>}
  </div>;
}

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [cpf, setCpf] = useState('');
  const [pass, setPass] = useState('');
  const [role, setRole] = useState('user');

  const handleCpf = (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    setCpf(v);
  };

  const handleSubmit = () => {
    if (!cpf || cpf.length !== 11 || !pass) return;
    // Simulate login
    login({ name: '', sector: '', role });
  };

  return (
    <div className="reply" style={{ display: 'flex' }}>
      <div className="reply-card">
        <h3 id="login-title">Entrar</h3>
        <div className="field">
          <label htmlFor="login-cpf">CPF</label>
          <input 
            id="login-cpf" 
            type="text" 
            placeholder="000.000.000-00" 
            maxLength={11} 
            inputMode="numeric"
            value={cpf}
            onChange={handleCpf}
          />
        </div>
        <div className="field">
          <label htmlFor="login-pass">Senha</label>
          <input 
            id="login-pass" 
            type="password" 
            placeholder="Sua senha" 
            maxLength={64}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-role">Perfil</label>
          <select id="login-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">SOLICITANTE</option>
            <option value="admin">ATENDENTE</option>
          </select>
        </div>
        <div className="actions">
          <button id="login-cancel" className="btn-glass">Cancelar</button>
          <button id="login-confirm" className="btn-accent" onClick={handleSubmit}>Entrar</button>
        </div>
      </div>
    </div>
  );
}

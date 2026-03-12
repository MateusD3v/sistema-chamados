import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Header({ activeTab, setActiveTab }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const userWrapRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userWrapRef.current && !userWrapRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
  };

  return (
    <header className="appbar">
      {user.role === 'admin' && (
        <nav className="tabs">
          <button 
            className={`tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Atendimentos
          </button>
          <button 
            className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Painel
          </button>
        </nav>
      )}

      <div className={`user-wrap ${menuOpen ? 'open' : ''}`} ref={userWrapRef}>
        <button 
          id="user-btn" 
          className="user-btn" 
          aria-haspopup="true" 
          aria-expanded={menuOpen} 
          title="Conta"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className="user-ico">👤</span>
          <span className="user-info">
            <span className="user-name">{user.name || 'Usuário'}</span>
            <span className="user-sub">{user.sector || ''}</span>
          </span>
          <span className="user-caret">▾</span>
        </button>
        {menuOpen && (
          <div id="user-menu" className="user-menu" style={{ display: 'block' }}>
            {user.role === 'admin' && (
              <button className="user-item" onClick={() => { setActiveTab('dashboard'); setMenuOpen(false); }}>Painel</button>
            )}
            <button className="user-item">Meus Dados</button>
            <button className="user-item">Relatório de Acesso</button>
            <button className="user-item danger" onClick={handleLogout}>Efetuar Logout</button>
          </div>
        )}
      </div>
    </header>
  );
}

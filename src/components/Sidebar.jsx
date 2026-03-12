import { useState } from 'react';

export default function Sidebar({ isOpen, onClose }) {
  // Sidebar component handles its own state for groups
  const [meusOpen, setMeusOpen] = useState(true);
  const [outrosOpen, setOutrosOpen] = useState(false);

  return (
    <>
      <div className={`drawer ${isOpen ? 'open' : ''}`}>
        <div className="sbar">
          <div className="sbar-head">
            <div className="sbar-logo">NTDESK</div>
          </div>
          
          <div className={`sbar-group ${meusOpen ? 'open' : ''}`}>
            <button className="sbar-group-head" type="button" onClick={() => setMeusOpen(!meusOpen)}>
              Meus Chamados<span className="chev">›</span>
            </button>
            <div className="sbar-group-body">
              <button className="sbar-item">
                <span className="label">Em atendimento</span>
                <span className="badge">0</span>
              </button>
              <button className="sbar-item">
                <span className="label">Fechado</span>
                <span className="badge">0</span>
              </button>
              <button className="sbar-item">
                <span className="label">Contestado</span>
                <span className="badge">0</span>
              </button>
              <button className="sbar-item">
                <span className="label">Abertos</span>
                <span className="badge">0</span>
              </button>
            </div>
          </div>

          <div className={`sbar-group ${outrosOpen ? 'open' : ''}`}>
            <button className="sbar-group-head" type="button" onClick={() => setOutrosOpen(!outrosOpen)}>
              Outros<span className="chev">›</span>
            </button>
            <div className="sbar-group-body">
              <button className="sbar-item">
                <span className="label">Aguardando aprovacao</span>
                <span className="badge">0</span>
              </button>
              <button className="sbar-item">
                <span className="label">Colaborando</span>
                <span className="badge">0</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {isOpen && (
        <div className="drawer-backdrop show" onClick={onClose} />
      )}
    </>
  );
}

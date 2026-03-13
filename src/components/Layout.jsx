import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import TicketForm from './TicketForm';
import TicketList from './TicketList';
import Dashboard from './Dashboard';
import { loadTickets } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('tickets');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'ABERTO', 'EM_ANDAMENTO', 'FECHADO'
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [counts, setCounts] = useState({ ABERTO: 0, EM_ANDAMENTO: 0, FECHADO: 0 });

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1);
    const all = loadTickets();
    const newCounts = { ABERTO: 0, EM_ANDAMENTO: 0, FECHADO: 0 };
    all.forEach(t => {
      if (newCounts[t.status] !== undefined) newCounts[t.status]++;
    });
    setCounts(newCounts);
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') {
      if (activeTab === 'tickets') setActiveTab('admin');
    } else if (activeTab !== 'tickets') {
      setActiveTab('tickets');
    }
  }, [user, activeTab]);

  const handleTicketCreated = () => {
    refreshData();
  };

  return (
    <div className="shell">
      <Sidebar 
        isOpen={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        filter={filter}
        setFilter={setFilter}
        counts={counts}
      />
      
      <button 
        id="toggle-drawer" 
        className="drawer-toggle" 
        aria-label={drawerOpen ? 'Fechar menu' : 'Abrir menu'}
        onClick={() => setDrawerOpen(!drawerOpen)}
      >
        {drawerOpen ? '✕' : '☰'}
      </button>

      <div className="main">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main className={`container grid-cards ${activeTab === 'admin' || activeTab === 'dashboard' ? 'full' : ''} ${activeTab === 'tickets' ? 'tickets' : ''}`}>
          <div className={activeTab === 'dashboard' || activeTab === 'admin' ? 'workspace admin' : 'workspace tickets'}>
            {activeTab === 'tickets' && (
              <>
                {user?.role !== 'admin' && (
                  <TicketForm onTicketCreated={handleTicketCreated} />
                )}
                <TicketList filter={filter} setFilter={setFilter} refreshTrigger={refreshTrigger} onUpdate={refreshData} />
              </>
            )}
            
            {activeTab === 'admin' && (
              <div style={{ gridColumn: '1 / -1', height: '100%' }}>
                <TicketList filter={filter} setFilter={setFilter} refreshTrigger={refreshTrigger} onUpdate={refreshData} />
              </div>
            )}
            
            {activeTab === 'dashboard' && (
              <Dashboard />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

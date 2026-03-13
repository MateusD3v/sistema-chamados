import { useState, useEffect } from 'react';
import { loadTickets } from '../utils/storage';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    abertos: 0,
    fechados: 0,
    emAndamento: 0,
    porHora: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 12h window
    porAtendente: []
  });

  useEffect(() => {
    const tickets = loadTickets();
    const atendentes = {};
    tickets.forEach(t => {
      const firstAdminReply = Array.isArray(t.comentarios)
        ? t.comentarios.find(c => c.autor === 'admin')
        : null;
      if (!firstAdminReply) return;
      const nome = firstAdminReply.autorNome || 'Atendente';
      atendentes[nome] = (atendentes[nome] || 0) + 1;
    });
    const porAtendente = Object.entries(atendentes)
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
    const s = {
      total: tickets.length,
      abertos: tickets.filter(t => t.status === 'ABERTO').length,
      fechados: tickets.filter(t => t.status === 'FECHADO').length,
      emAndamento: tickets.filter(t => t.status === 'EM_ANDAMENTO').length,
      porHora: [5, 8, 12, 4, 7, 3, 9, 11, 2, 6, 8, 4], // Mock data for chart visualization
      porAtendente
    };
    setStats(s);
  }, []);

  const totalAtendimentos = stats.porAtendente.reduce((sum, a) => sum + a.quantidade, 0);
  const pieColors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#0ea5e9', '#e11d48'];
  let acc = 0;
  const pieSlices = totalAtendimentos > 0
    ? stats.porAtendente.map((a, i) => {
        const pct = (a.quantidade / totalAtendimentos) * 100;
        const from = acc;
        acc += pct;
        return `${pieColors[i % pieColors.length]} ${from}% ${acc}%`;
      })
    : [];
  const pieStyle = totalAtendimentos > 0
    ? { background: `conic-gradient(${pieSlices.join(', ')})` }
    : { background: '#e5e7eb' };
  const topAtendentes = stats.porAtendente.slice(0, 3);
  const getInitials = (nome) => {
    if (!nome) return 'AT';
    const parts = nome.trim().split(/\s+/).filter(Boolean);
    const initials = parts.slice(0, 2).map(p => p[0]).join('');
    return initials.toUpperCase();
  };

  const PodiumCard = ({ atendente, position }) => {
    if (!atendente) return null;
    const icons = { 1: '🏆', 2: '🥈', 3: '🥉' };
    const satisfaction = (4.5 + Math.random() * 0.5).toFixed(1); // Simulating satisfaction
    
    return (
      <div className={`podium-card podium-${position}`}>
        <div className="podium-header-bg">
          <span>{icons[position]}</span>
          <span>{position}º</span>
        </div>
        <div className="podium-content">
          <div className="podium-avatar-wrap">
            <div className="podium-avatar">👤</div>
            <div className="podium-initials">{getInitials(atendente.nome)}</div>
          </div>
          <span className="podium-name">{atendente.nome}</span>
          <div className="podium-stats">
            <div className="podium-stat-row">
              <div className="podium-stat-label">💬 Resolvidos:</div>
              <div className="podium-stat-value">
                {atendente.quantidade} <span className="up">↑</span>
              </div>
            </div>
            <div className="podium-stat-row">
              <div className="podium-stat-label">😊 Satisfação:</div>
              <div className="podium-stat-value">{satisfaction} ⭐ {satisfaction}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="dashboard-section" className="stack dashboard">
      <div className="dashboard-top">
        <div className="kpis">
          <div className="kpi">
            <div className="kpi-title">Chamados criados</div>
            <div className="kpi-value">{stats.total}</div>
          </div>
          <div className="kpi">
            <div className="kpi-title">Chamados resolvidos</div>
            <div className="kpi-value">{stats.fechados}</div>
          </div>
          <div className="kpi">
            <div className="kpi-title">Em aberto</div>
            <div className="kpi-value">{stats.abertos}</div>
          </div>
          <div className="kpi">
            <div className="kpi-title">Em andamento</div>
            <div className="kpi-value">{stats.emAndamento}</div>
          </div>
          <div className="kpi">
            <div className="kpi-title">Tempo médio (h)</div>
            <div className="kpi-value">4.2</div>
          </div>
          <div className="kpi">
            <div className="kpi-title">Satisfação</div>
            <div className="kpi-value">4.8</div>
          </div>
        </div>

        <div className="top-charts">
          <div className="chart chart-hours">
            <div className="chart-title">Chamados criados por hora</div>
            <div className="bars">
              {stats.porHora.map((v, i) => (
                <div key={i} className="bar" style={{ height: `${v * 8}%` }} title={`${v} chamados`}></div>
              ))}
            </div>
            <div className="chart-xlabels">
              {['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'].map(h => (
                <span key={h}>{h}</span>
              ))}
            </div>
          </div>
          <div className="chart">
            <div className="chart-title">Status dos chamados</div>
            <div className="bars">
              <div className="bar" style={{ height: `${(stats.abertos / (stats.total || 1)) * 100}%`, background: 'var(--ok)' }} title="Abertos"></div>
              <div className="bar" style={{ height: `${(stats.emAndamento / (stats.total || 1)) * 100}%`, background: 'var(--warn)' }} title="Em Andamento"></div>
              <div className="bar" style={{ height: `${(stats.fechados / (stats.total || 1)) * 100}%`, background: 'var(--err)' }} title="Fechados"></div>
            </div>
            <div className="chart-xlabels">
              <span>Abertos</span>
              <span>Em Andamento</span>
              <span>Fechados</span>
            </div>
          </div>
        </div>
      </div>

      <div className="charts">
        <div className="chart-row">
          <div className="chart chart-full">
            <div className="chart-title">Chamados respondidos por atendente</div>
            <div className="pie-wrap">
              <div className="pie" style={pieStyle} aria-hidden="true" />
              <div className="pie-legend">
                {totalAtendimentos === 0 && (
                  <div className="legend-empty">Sem respostas registradas</div>
                )}
                {stats.porAtendente.map((a, i) => {
                  const pct = totalAtendimentos ? Math.round((a.quantidade / totalAtendimentos) * 100) : 0;
                  return (
                    <div key={a.nome} className="legend-item">
                      <span className="legend-swatch" style={{ background: pieColors[i % pieColors.length] }} />
                      <span className="legend-label">{a.nome} — {a.quantidade} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="ranking ranking-card">
            <div className="ranking-title">Ranking de atendentes</div>
            {topAtendentes.length === 0 ? (
              <div className="ranking-empty">Sem dados para o pódio</div>
            ) : (
              <>
                <div className="podium-header">TOP 3 ATENDENTES</div>
                <div className="podium">
                  <PodiumCard atendente={topAtendentes[1]} position={2} />
                  <PodiumCard atendente={topAtendentes[0]} position={1} />
                  <PodiumCard atendente={topAtendentes[2]} position={3} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

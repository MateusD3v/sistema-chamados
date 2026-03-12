import { useState, useEffect } from 'react';
import { loadTickets, saveTickets, updateTicket } from '../utils/storage';
import { formatDate, statusLabel } from '../utils/format';
import { ticketsToCSV } from '../utils/csv';
import { useAuth } from '../contexts/AuthContext';

export default function TicketList({ filter = 'ALL', setFilter, refreshTrigger, onUpdate }) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [page, setPage] = useState(1);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyFile, setReplyFile] = useState(null);
  const [replyFileName, setReplyFileName] = useState('Nenhum arquivo');
  const [replyTicketId, setReplyTicketId] = useState(null);
  const [replyRole, setReplyRole] = useState('admin');
  const [expandedReplies, setExpandedReplies] = useState({});
  const PAGE_SIZE = 6;

  const loadData = () => {
    const all = loadTickets();
    const filtered = filter === 'ALL' 
      ? all 
      : all.filter(t => t.status === filter);
    filtered.sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm));
    setTickets(filtered);
  };

  useEffect(() => {
    loadData();
  }, [filter, refreshTrigger]);
  
  useEffect(() => {
    setPage(1);
  }, [filter]);

  const handleStatusChange = (id, newStatus) => {
    if (newStatus === 'FECHADO') {
      const name = prompt('Informe seu nome para fechar o chamado:');
      if (!name || !name.trim()) return;
      updateTicket(id, { status: newStatus, closedBy: name.trim() });
    } else {
      updateTicket(id, { status: newStatus });
    }
    loadData();
    if (onUpdate) onUpdate();
  };

  const totalPages = Math.ceil(tickets.length / PAGE_SIZE) || 1;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);
  const currentList = tickets.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    const data = ticketsToCSV(loadTickets());
    const bom = '\uFEFF';
    const blob = new Blob([bom, data], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chamados.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const openReply = (id, role) => {
    setReplyTicketId(id);
    setReplyRole(role);
    setReplyText('');
    setReplyFile(null);
    setReplyFileName('Nenhum arquivo');
    setReplyOpen(true);
  };

  const closeReply = () => {
    setReplyOpen(false);
    setReplyTicketId(null);
    setReplyText('');
    setReplyFile(null);
    setReplyFileName('Nenhum arquivo');
  };

  const handlePickFile = (e) => {
    const f = e.target.files && e.target.files[0];
    setReplyFile(f || null);
    setReplyFileName(f ? f.name : 'Nenhum arquivo');
  };

  const handleSendReply = async () => {
    if (!replyTicketId) { closeReply(); return; }
    const msg = replyText.trim();
    if (!msg && !replyFile) { closeReply(); return; }
    const list = loadTickets();
    const idx = list.findIndex(t => t.id === replyTicketId);
    if (idx === -1) { closeReply(); return; }
    const nowIso = new Date().toISOString();
    const before = list[idx];
    const updated = { ...before };
    updated.status = 'EM_ANDAMENTO';
    updated.atualizadoEm = nowIso;
    if (replyRole === 'admin' && !updated.firstResponseAt) updated.firstResponseAt = nowIso;
    if (before.status === 'FECHADO') {
      delete updated.closedAt;
      delete updated.closedBy;
    }
    if (!Array.isArray(updated.comentarios)) updated.comentarios = [];
    const authorName = user?.name && user.name.trim()
      ? user.name.trim()
      : (replyRole === 'admin' ? 'Atendente' : 'Solicitante');
    const comment = { autor: replyRole, autorNome: authorName, mensagem: msg, em: nowIso };
    if (replyFile) {
      const isJpg = replyFile.type === 'image/jpeg' || /\.jpe?g$/i.test(replyFile.name);
      const isPng = replyFile.type === 'image/png' || /\.png$/i.test(replyFile.name);
      if (isJpg || isPng) {
        const dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(replyFile);
        });
        const mime = isPng ? 'image/png' : 'image/jpeg';
        comment.anexos = [{ name: replyFile.name, type: mime, dataUrl }];
      }
    }
    updated.comentarios = [...updated.comentarios, comment];
    list[idx] = updated;
    saveTickets(list);
    loadData();
    if (onUpdate) onUpdate();
    closeReply();
  };

  const toggleReply = (id) => {
    setExpandedReplies(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      <section className="card card-elev ws-center">
        <div className="card-head">
          <h2 className="card-title">Chamados</h2>
        </div>
      
      <div className="filters">
        <button 
          className={`chip ${filter === 'ALL' ? 'active' : ''}`} 
          onClick={() => setFilter && setFilter('ALL')}
        >
          Todos
        </button>
        <button 
          className={`chip ${filter === 'ABERTO' ? 'active' : ''}`} 
          onClick={() => setFilter && setFilter('ABERTO')}
        >
          Aberto
        </button>
        <button 
          className={`chip ${filter === 'EM_ANDAMENTO' ? 'active' : ''}`} 
          onClick={() => setFilter && setFilter('EM_ANDAMENTO')}
        >
          Em andamento
        </button>
        <button 
          className={`chip ${filter === 'FECHADO' ? 'active' : ''}`} 
          onClick={() => setFilter && setFilter('FECHADO')}
        >
          Fechado
        </button>
        <button className="btn-glass" onClick={handleExport}>Exportar</button>
      </div>

        <div className="list-footer list-header">
          <div className="summary">
            Página {page} de {totalPages} ({tickets.length} chamados)
          </div>
          <div className="pager">
            <button 
              className="btn-glass" 
              disabled={page <= 1} 
              onClick={() => setPage(p => p - 1)}
            >
              Anterior
            </button>
            <button 
              className="btn-glass" 
              disabled={page >= totalPages} 
              onClick={() => setPage(p => p + 1)}
            >
              Próximo
            </button>
          </div>
        </div>

        <div className="lista">
          {currentList.length === 0 ? (
            <div className="vazio">Nenhum chamado encontrado.</div>
          ) : (
            currentList.map(t => {
              const lastReply = Array.isArray(t.comentarios) && t.comentarios.length
                ? t.comentarios[t.comentarios.length - 1]
                : null;
              const replyTextLen = lastReply?.mensagem ? lastReply.mensagem.length : 0;
              const isExpanded = !!expandedReplies[t.id];
              return (
                <div key={t.id} className="ticket">
                  <div className="ticket-head">
                    <div className="title">{t.id} — {t.titulo}</div>
                    <div className={`status ${t.status}`}>{statusLabel(t.status)}</div>
                  </div>
                  <div className="ticket-body">
                    <div className="ticket-meta">Atualizado: {formatDate(t.atualizadoEm)}</div>
                    {t.setor && <div>Setor: {t.setor}</div>}
                    {t.solicitante && <div>Solicitante: {t.solicitante}</div>}
                    {t.closedBy && <div className="ticket-meta">Fechado por: {t.closedBy}</div>}
                    {lastReply && (
                      <div className={`ticket-reply ${isExpanded ? 'expanded' : ''}`}>
                        {replyTextLen > 150 && (
                          <button className="btn-glass" style={{ alignSelf: 'flex-end' }} onClick={() => toggleReply(t.id)}>
                            {isExpanded ? 'Ver menos' : 'Ver mais'}
                          </button>
                        )}
                        <div className="text">
                          {(lastReply.autor === 'admin' ? 'Atendente' : 'Solicitante')}
                          {': '}
                          {lastReply.mensagem || '(sem mensagem)'}
                          {lastReply.em ? ` — ${formatDate(lastReply.em)}` : ''}
                        </div>
                        {Array.isArray(lastReply.anexos) && lastReply.anexos.map((ax, i) => (
                          (ax.type === 'image/jpeg' || ax.type === 'image/png') && ax.dataUrl ? (
                            <img key={i} src={ax.dataUrl} alt={ax.name || 'anexo'} />
                          ) : null
                        ))}
                        {user.role !== 'admin' && lastReply.autor === 'admin' && t.status !== 'FECHADO' && (
                          <button className="btn-glass" onClick={() => openReply(t.id, 'user')}>Responder Atendimento</button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {user.role === 'admin' && (
                    <div className="ticket-actions">
                      {t.status !== 'EM_ANDAMENTO' && (
                        <button className="btn-glass" onClick={() => openReply(t.id, 'admin')}>Responder Chamado</button>
                      )}
                      {t.status === 'ABERTO' && (
                        <button className="btn-glass" onClick={() => handleStatusChange(t.id, 'EM_ANDAMENTO')}>Atender</button>
                      )}
                      {t.status === 'EM_ANDAMENTO' && (
                        <>
                          <button className="btn-glass" onClick={() => handleStatusChange(t.id, 'ABERTO')}>Devolver</button>
                          <button className="btn-glass" onClick={() => handleStatusChange(t.id, 'FECHADO')}>Fechar</button>
                        </>
                      )}
                      {t.status === 'FECHADO' && (
                        <button className="btn-glass" onClick={() => handleStatusChange(t.id, 'ABERTO')}>Reabrir</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="list-footer">
          <div className="summary">
            Página {page} de {totalPages} ({tickets.length} chamados)
          </div>
          <div className="pager">
            <button 
              className="btn-glass" 
              disabled={page <= 1} 
              onClick={() => setPage(p => p - 1)}
            >
              Anterior
            </button>
            <button 
              className="btn-glass" 
              disabled={page >= totalPages} 
              onClick={() => setPage(p => p + 1)}
            >
              Próximo
            </button>
          </div>
        </div>
      </section>

      <div className={`reply ${replyOpen ? '' : 'hidden'}`}>
        <div className="reply-card">
          <h3 id="reply-title">Responder Atendimento</h3>
          <textarea 
            id="reply-text"
            rows={4}
            placeholder="Escreva sua resposta..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <div className="file-line">
            <label htmlFor="reply-file">Anexar imagem (JPG/PNG):</label>
            <input 
              id="reply-file" 
              type="file" 
              accept=".jpg,.jpeg,.png,image/jpeg,image/png" 
              onChange={handlePickFile}
              style={{ display: 'none' }}
            />
            <div className="file-actions">
              <button type="button" className="btn-accent" onClick={() => document.getElementById('reply-file')?.click()}>
                Escolher arquivo
              </button>
              <span className="filename">{replyFileName}</span>
            </div>
          </div>
          <div className="actions">
            <button id="reply-cancel" className="btn-glass" onClick={closeReply}>Cancelar</button>
            <button
              id="reply-send"
              type="button"
              className="btn-accent"
              onClick={handleSendReply}
              translate="no"
              aria-label="Enviar"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

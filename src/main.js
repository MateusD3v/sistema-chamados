import { loadTickets, saveTickets, nextId } from './storage.js';
import { ticketsToCSV, parseCSV } from './csv.js';

let filterState = 'ALL';
let searchQuery = '';
let lastAction = null;
let selectedTicketId = null;
let page = 1;
const PAGE_SIZE = 4;
let adminMode = false;
let replyingTicketId = null;
let replyDlg, replyText, replySend, replyCancel;
let replyRole = 'admin';
let replyOpener = null;
const UI_STATE_KEY = 'ui.state.v1';
const AUTH_KEY = 'auth.v1';
// Close ticket dialog (global)
let closeDlg, closeName, closeConfirm, closeCancel;
let closingTicketId = null;

function openClose(id) {
  closingTicketId = id;
  if (closeDlg) closeDlg.classList.remove('hidden');
  if (closeName) { closeName.value = ''; closeName.focus(); }
}
function closeClose() {
  closingTicketId = null;
  if (closeDlg) closeDlg.classList.add('hidden');
}

function loadUIState() {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveUIState(partial) {
  const s = { ...(loadUIState() || {}), ...partial };
  localStorage.setItem(UI_STATE_KEY, JSON.stringify(s));
}
function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveAuth(auth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth || null));
}
function applyAuthUI(auth) {
  // Tabs visibility by role
  const tabTickets = document.querySelector('.tab[data-tab="tickets"]');
  const tabAdmin = document.querySelector('.tab[data-tab="admin"]');
  const tabDash = document.querySelector('.tab[data-tab="dashboard"]');
  if (auth?.role === 'admin') {
    tabAdmin && (tabAdmin.style.display = '');
    tabDash && (tabDash.style.display = '');
    // Mostrar item Dashboard no menu do usuário
    const dashItem = document.querySelector('#user-menu .user-item[data-action="dashboard"]');
    if (dashItem) { dashItem.classList.remove('hidden'); dashItem.style.display = ''; }
  } else {
    tabAdmin && (tabAdmin.style.display = 'none');
    tabDash && (tabDash.style.display = 'none');
    document.querySelector('.tab[data-tab="tickets"]')?.click();
    // Ocultar item Dashboard no menu do usuário
    const dashItem = document.querySelector('#user-menu .user-item[data-action="dashboard"]');
    if (dashItem) { dashItem.classList.add('hidden'); dashItem.style.display = 'none'; }
  }
  // Header user info (if exists)
  const nameEl = document.querySelector('.user-name');
  const sectEl = document.querySelector('.user-sub');
  if (nameEl) nameEl.textContent = auth?.name || 'Usuário';
  if (sectEl) sectEl.textContent = auth?.sector || '';
}
function formatDate(iso) {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm} ${hh}:${mi}`;
  } catch { return ''; }
}

function openReply(id, role = 'admin') {
  replyingTicketId = id;
  replyRole = role;
  replyOpener = document.activeElement;
  if (replyDlg) replyDlg.classList.remove('hidden');
  if (replyText) { replyText.value = ''; replyText.focus(); }
}

function closeReply() {
  replyingTicketId = null;
  if (replyDlg) replyDlg.classList.add('hidden');
  if (replyOpener && typeof replyOpener.focus === 'function') {
    try { replyOpener.focus(); } catch {}
  }
  replyOpener = null;
}

function statusLabel(s) {
  if (s === 'ABERTO') return 'Aberto';
  if (s === 'EM_ANDAMENTO') return 'Em andamento';
  if (s === 'FECHADO') return 'Fechado';
  return s;
}

function renderSidebarCounts(list) {
  const counts = {
    ABERTO: list.filter(t => t.status === 'ABERTO').length,
    EM_ANDAMENTO: list.filter(t => t.status === 'EM_ANDAMENTO').length,
    FECHADO: list.filter(t => t.status === 'FECHADO').length,
  };
  document.querySelectorAll('[data-badge]').forEach(el => {
    const key = el.getAttribute('data-badge');
    el.textContent = counts[key] ?? 0;
  });
}

function filtered(list) {
  let r = [...list];
  if (filterState !== 'ALL') r = r.filter(t => t.status === filterState);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    r = r.filter(t => t.titulo.toLowerCase().includes(q) || t.descricao.toLowerCase().includes(q));
  }
  return r;
}

function renderLista(items) {
  const el = document.getElementById('lista');
  el.innerHTML = '';
  if (!items.length) {
    el.innerHTML = '<div class="vazio">Nenhum chamado</div>';
    renderSidebarCounts(items);
    renderFooter(0, 0);
    return;
  }
  // Ordena do mais antigo para o mais novo, assim os 4 primeiros permanecem na primeira página
  // e o último chamado criado passa para a próxima página quando exceder o limite.
  const viewFull = filtered(items).sort((a, b) => a.id - b.id);
  if (!viewFull.length) {
    el.innerHTML = '<div class="vazio">Nenhum resultado</div>';
    renderSidebarCounts(items);
    renderFooter(0, 0);
    return;
  }
  const total = viewFull.length;
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > maxPage) page = maxPage;
  const start = (page - 1) * PAGE_SIZE;
  const slice = viewFull.slice(start, start + PAGE_SIZE);
  for (const t of slice) {
    const card = document.createElement('div');
    card.className = 'ticket' + (t.id === selectedTicketId ? ' selected' : '');
    const actions = [];
    if (adminMode) {
      if (t.status !== 'EM_ANDAMENTO') actions.push({ s: 'EM_ANDAMENTO', label: 'Responder Chamado' });
      if (t.status !== 'FECHADO') actions.push({ s: 'FECHADO', label: 'Fechar' });
      if (t.status !== 'ABERTO') actions.push({ s: 'ABERTO', label: 'Reabrir' });
    } else {
      // Em "Chamado", não exibir ações de status (incluindo Reabrir)
    }
    const head = document.createElement('div');
    head.className = 'ticket-head';
    const title = document.createElement('div');
    title.className = 'title';
  title.textContent = `${t.id} — ${t.titulo}`;
    const status = document.createElement('div');
    status.className = `status ${t.status}`;
    status.textContent = statusLabel(t.status);
    head.appendChild(title);
    head.appendChild(status);
    const body = document.createElement('div');
    body.className = 'ticket-body';
    body.textContent = '';
  const meta = document.createElement('div');
  meta.className = 'ticket-meta';
  meta.textContent = t.atualizadoEm ? `Atualizado: ${formatDate(t.atualizadoEm)}` : '';
  body.appendChild(meta);
    if (t.setor) {
      const l1 = document.createElement('div');
      l1.textContent = `Setor: ${t.setor}`;
      body.appendChild(l1);
    }
    if (t.solicitante) {
      const l2 = document.createElement('div');
      l2.textContent = `Solicitante: ${t.solicitante}`;
      body.appendChild(l2);
    }
    // Última resposta (se existir)
    if (Array.isArray(t.comentarios) && t.comentarios.length) {
      const last = t.comentarios[t.comentarios.length - 1];
      const rep = document.createElement('div');
      rep.className = 'ticket-reply';
      const txt = document.createElement('div');
      txt.className = 'text';
      const who = last.autor === 'admin' ? 'Atendente' : 'Solicitante';
      const when = last.em ? ` — ${formatDate(last.em)}` : '';
      txt.textContent = `${who}: ${last.mensagem || '(sem mensagem)'}${when}`;
      rep.appendChild(txt);
      if ((last.mensagem || '').length > 150) {
        const topMore = document.createElement('button');
        topMore.className = 'btn-glass';
        topMore.textContent = 'Ver mais';
        topMore.style.alignSelf = 'flex-end';
        topMore.style.display = 'none';
        const bottomMore = document.createElement('button');
        bottomMore.className = 'btn-glass';
        bottomMore.textContent = 'Ver mais';
        const toggle = (e) => {
          e.stopPropagation();
          const exp = rep.classList.toggle('expanded');
          const label = exp ? 'Ver menos' : 'Ver mais';
          topMore.textContent = label;
          bottomMore.textContent = label;
          topMore.style.display = exp ? '' : 'none';
        };
        topMore.addEventListener('click', toggle);
        bottomMore.addEventListener('click', toggle);
        rep.appendChild(bottomMore);
        // Inserir o botão superior acima do texto
        rep.insertBefore(topMore, txt);
      }
      if (Array.isArray(last.anexos) && last.anexos.length) {
        last.anexos.forEach(ax => {
          if ((ax.type === 'image/jpeg' || ax.type === 'image/png') && ax.dataUrl) {
            const img = document.createElement('img');
            img.src = ax.dataUrl;
            img.alt = ax.name || 'anexo';
            rep.appendChild(img);
          }
        });
      }
      if (!adminMode && last.autor === 'admin' && t.status !== 'FECHADO') {
        const replyBtn = document.createElement('button');
        replyBtn.className = 'btn-glass';
        replyBtn.textContent = 'Responder Atendimento';
        replyBtn.addEventListener('click', (e) => { e.stopPropagation(); openReply(t.id, 'user'); });
        rep.appendChild(replyBtn);
      }
      body.appendChild(rep);
    }
    const actionsEl = document.createElement('div');
    actionsEl.className = 'ticket-actions';
    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(actionsEl);
    card.addEventListener('click', (e) => {
      if (e.target.closest('.ticket-actions')) return;
      selectedTicketId = t.id;
      renderLista(loadTickets());
      renderDetalhe(loadTickets());
    });
    for (const a of actions) {
      const b = document.createElement('button');
      b.className = 'btn-glass';
      b.textContent = a.label;
      b.addEventListener('click', () => {
        if (adminMode && a.s === 'EM_ANDAMENTO') {
          openReply(t.id);
          return;
        }
        const list = loadTickets();
        const idx = list.findIndex(x => x.id === t.id);
        if (idx !== -1) {
          const before = { ...list[idx] };
        if (adminMode && a.s === 'FECHADO') { openClose(t.id); return; }
        const nowIso = new Date().toISOString();
        if (before.status === 'FECHADO') { delete list[idx].closedAt; delete list[idx].closedBy; }
        list[idx].status = a.s;
        list[idx].atualizadoEm = nowIso;
          saveTickets(list);
          lastAction = { type: 'status', before, after: { ...list[idx] } };
          updateUndoState();
          renderLista(list);
          renderDashboard(list);
          renderSidebarCounts(list);
          renderDetalhe(list);
        }
      });
      actionsEl.appendChild(b);
    }
    const del = document.createElement('button');
    del.className = 'btn-glass btn-danger';
    del.textContent = 'Excluir';
    del.addEventListener('click', () => {
      if (!confirm('Excluir este chamado?')) return;
      const list = loadTickets();
      const idx = list.findIndex(x => x.id === t.id);
      if (idx !== -1) {
        const before = { ...list[idx] };
        list.splice(idx, 1);
        saveTickets(list);
        lastAction = { type: 'delete', before };
        updateUndoState();
        if (selectedTicketId === t.id) selectedTicketId = null;
        renderLista(list);
        renderDashboard(list);
        renderSidebarCounts(list);
        renderDetalhe(list);
      }
    });
    actionsEl.appendChild(del);
    el.appendChild(card);
  }
  renderSidebarCounts(items);
  renderDetalhe(items);
  renderFooter(total, slice.length);
}

function main() {
  const form = document.getElementById('novo-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const titulo = document.getElementById('titulo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    const setor = document.getElementById('setor')?.value.trim() || '';
    const solicitante = document.getElementById('solicitante')?.value.trim() || '';
    if (!titulo || !descricao || !setor || !solicitante) return;
    const list = loadTickets();
    const now = new Date().toISOString();
    const ticket = {
      id: nextId(list),
      titulo,
      descricao,
      setor,
      solicitante,
      status: 'ABERTO',
      criadoEm: now,
      atualizadoEm: now
    };
    list.push(ticket);
    saveTickets(list);
    lastAction = { type: 'create', id: ticket.id };
    updateUndoState();
    form.reset();
    // Ir para a última página para exibir o novo chamado
    const filt = filtered(list);
    page = Math.max(1, Math.ceil(filt.length / PAGE_SIZE));
    saveUIState({ page });
    renderLista(list);
    renderDashboard(list);
    renderSidebarCounts(list);
    selectedTicketId = ticket.id;
    renderDetalhe(list);
  });

  const filters = document.getElementById('filtros');
  if (filters) {
    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      filterState = btn.dataset.filter;
      filters.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.orbit-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === filterState));
      renderLista(loadTickets());
    });
  }

  const exportBtn = document.getElementById('export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const data = ticketsToCSV(loadTickets());
      const bom = '\uFEFF';
      const blob = new Blob([bom, data], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'chamados.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }


  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'n') { document.getElementById('titulo')?.focus(); }
    if (e.key === '1') setFilter('ALL');
    if (e.key === '2') setFilter('ABERTO');
    if (e.key === '3') setFilter('EM_ANDAMENTO');
    if (e.key === '4') setFilter('FECHADO');
  });

  document.querySelectorAll('.orbit-btn').forEach(b => {
    b.addEventListener('click', () => setFilter(b.dataset.filter));
  });
  document.querySelector('.tour-next')?.addEventListener('click', () => showTourStep(2));
  document.querySelector('.tour-close')?.addEventListener('click', closeTour);
  document.getElementById('undo')?.addEventListener('click', undoLast);
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      const tab = t.dataset.tab;
      const auth = loadAuth();
      if ((tab === 'admin' || tab === 'dashboard') && auth?.role !== 'admin') {
        return; // bloqueia acesso
      }
      document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
      // Em 'admin', reutilizamos a mesma seção de tickets, apenas mudando o título/contexto
      document.getElementById('tickets-section').style.display = (tab === 'tickets' || tab === 'admin') ? '' : 'none';
      document.getElementById('dashboard-section').style.display = tab === 'dashboard' ? '' : 'none';
      adminMode = tab === 'admin';
      saveUIState({ tab });
      const titleEl = document.querySelector('.ws-center .card-title');
      if (titleEl) titleEl.textContent = adminMode ? 'Atendimentos' : 'Chamados';
      // Oculta a seção "Novo Chamado" (ws-left) e expande o main na aba Atendimentos
      const leftPane = document.querySelector('.ws-left');
      const workspace = document.querySelector('.workspace');
      const mainGrid = document.querySelector('main.grid-cards');
      if (adminMode) {
        if (leftPane) {
          leftPane.setAttribute('hidden', '');
          leftPane.style.display = 'none';
        }
        workspace?.classList.add('admin');
        mainGrid?.classList.add('full');
      } else {
        if (leftPane) {
          leftPane.removeAttribute('hidden');
          leftPane.style.display = '';
        }
        workspace?.classList.remove('admin');
        mainGrid?.classList.remove('full');
        // Em Chamado, garantir que o filtro mostre tudo para o usuário ver respostas recentes
        setFilter('ALL');
      }
      const filtros = document.getElementById('filtros');
      if (filtros) filtros.style.display = adminMode ? '' : 'none';
      if (tab === 'dashboard') {
        renderDashboard(loadTickets());
      } else {
        renderLista(loadTickets());
      }
    });
  });
  document.getElementById('sb-new')?.addEventListener('click', () => {
    document.getElementById('titulo')?.focus();
  });
  document.querySelectorAll('.sbar-item[data-filter]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.sbar-item.active').forEach(el => el.classList.remove('active'));
      b.classList.add('active');
      setFilter(b.dataset.filter);
    });
  });
  document.querySelectorAll('.sbar-group-head').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
  });
  const drawer = document.getElementById('drawer');
  const backdrop = document.getElementById('drawer-backdrop');
  const toggle = document.getElementById('toggle-drawer');
  const userWrap = document.getElementById('user-wrap');
  const userBtn = document.getElementById('user-btn');
  const userMenu = document.getElementById('user-menu');
  // Delegated clicks dentro da barra lateral (drawer)
  drawer?.addEventListener('click', (e) => {
    const newBtn = e.target.closest?.('#sb-new');
    if (newBtn) { document.getElementById('titulo')?.focus(); return; }
    const head = e.target.closest?.('.sbar-group-head');
    if (head) { head.parentElement.classList.toggle('open'); return; }
    const item = e.target.closest?.('.sbar-item[data-filter]');
    if (item) {
      document.querySelectorAll('.sbar-item.active').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      setFilter(item.dataset.filter);
      closeDrawer();
    }
  });
  // Reply dialog
  replyDlg = document.getElementById('reply-dialog');
  replyText = document.getElementById('reply-text');
  replySend = document.getElementById('reply-send');
  replyCancel = document.getElementById('reply-cancel');
  const replyFile = document.getElementById('reply-file');
  const replyPick = document.getElementById('reply-pick');
  const replyFname = document.getElementById('reply-fname');
  replyPick?.addEventListener('click', () => replyFile?.click());
  replyFile?.addEventListener('change', () => {
    const f = replyFile.files && replyFile.files[0];
    if (replyFname) replyFname.textContent = f ? f.name : 'Nenhum arquivo';
  });
  const imgViewer = document.getElementById('img-viewer');
  const imgViewerImg = document.getElementById('img-viewer-img');
  const imgViewerClose = document.getElementById('img-viewer-close');
  // Close ticket dialog
  closeDlg = document.getElementById('close-dialog');
  closeName = document.getElementById('close-name');
  closeConfirm = document.getElementById('close-confirm');
  closeCancel = document.getElementById('close-cancel');
  replySend?.addEventListener('click', async () => {
    const msg = replyText.value.trim();
    if ((!msg && !(replyFile && replyFile.files && replyFile.files.length)) || replyingTicketId == null) { closeReply(); return; }
    const list = loadTickets();
    const idx = list.findIndex(x => x.id === replyingTicketId);
    if (idx !== -1) {
      const nowIso = new Date().toISOString();
      list[idx].status = 'EM_ANDAMENTO';
      list[idx].atualizadoEm = nowIso;
      if (replyRole === 'admin' && !list[idx].firstResponseAt) list[idx].firstResponseAt = nowIso;
      if (!Array.isArray(list[idx].comentarios)) list[idx].comentarios = [];
      const comment = { autor: replyRole, mensagem: msg, em: nowIso };
      if (replyFile && replyFile.files && replyFile.files[0]) {
        const file = replyFile.files[0];
        const isJpg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
        const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
        if (isJpg || isPng) {
          const dataUrl = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = reject;
            fr.readAsDataURL(file);
          });
          const mime = isPng ? 'image/png' : 'image/jpeg';
          comment.anexos = [{ name: file.name, type: mime, dataUrl }];
        }
      }
      list[idx].comentarios.push(comment);
      saveTickets(list);
      renderLista(list);
      renderDashboard(list);
      renderSidebarCounts(list);
      renderDetalhe(list);
    }
    if (replyFile) replyFile.value = '';
    if (replyFname) replyFname.textContent = 'Nenhum arquivo';
    closeReply();
  });
  replyCancel?.addEventListener('click', closeReply);
  function openImage(src, alt='anexo') {
    if (!imgViewer || !imgViewerImg) return;
    imgViewerImg.src = src;
    imgViewerImg.alt = alt;
    imgViewer.classList.remove('hidden');
    document.body.classList.add('no-scroll');
  }
  function closeImage() {
    if (!imgViewer || !imgViewerImg) return;
    imgViewerImg.src = '';
    imgViewer.classList.add('hidden');
    document.body.classList.remove('no-scroll');
  }
  imgViewerClose?.addEventListener('click', closeImage);
  imgViewer?.addEventListener('click', (e) => { if (e.target === imgViewer) closeImage(); });
  document.addEventListener('click', (e) => {
    const img = e.target?.closest?.('.ticket-reply img');
    if (img) {
      e.preventDefault();
      openImage(img.src, img.alt || 'anexo');
    }
  });
  // Login dialog
  const loginDlg = document.getElementById('login-dialog');
  const loginName = document.getElementById('login-name');
  const loginSector = document.getElementById('login-sector');
  const loginRole = document.getElementById('login-role');
  const loginConfirm = document.getElementById('login-confirm');
  const loginCancel = document.getElementById('login-cancel');
  const loginCpfInput = document.getElementById('login-cpf');
  loginCpfInput?.addEventListener('input', () => {
    let v = loginCpfInput.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    loginCpfInput.value = v;
  });
  function openLogin() { loginDlg?.classList.remove('hidden'); document.getElementById('login-cpf')?.focus(); }
  function closeLogin() { loginDlg?.classList.add('hidden'); }
  loginCancel?.addEventListener('click', closeLogin);
  loginConfirm?.addEventListener('click', () => {
    const name = loginName?.value?.trim();
    const sector = loginSector?.value?.trim();
    const cpf = document.getElementById('login-cpf')?.value?.trim();
    const pass = document.getElementById('login-pass')?.value?.trim();
    const role = loginRole?.value === 'admin' ? 'admin' : 'user';
    if (!cpf || cpf.length !== 11 || !/^\d{11}$/.test(cpf) || !pass) return;
    const auth = { name: name || '', sector: sector || '', role };
    saveAuth(auth);
    closeLogin();
    applyAuthUI(auth);
    if (role === 'admin') {
      document.querySelector('.tab[data-tab="admin"]')?.click();
    } else {
      document.querySelector('.tab[data-tab="tickets"]')?.click();
    }
  });
  closeCancel?.addEventListener('click', closeClose);
  closeConfirm?.addEventListener('click', () => {
    const nome = closeName?.value?.trim();
    if (!nome || closingTicketId == null) { closeClose(); return; }
    const list = loadTickets();
    const idx = list.findIndex(x => x.id === closingTicketId);
    if (idx !== -1) {
      const nowIso = new Date().toISOString();
      const before = { ...list[idx] };
      list[idx].status = 'FECHADO';
      list[idx].closedBy = nome;
      list[idx].closedAt = nowIso;
      list[idx].atualizadoEm = nowIso;
      saveTickets(list);
      lastAction = { type: 'status', before, after: { ...list[idx] } };
      updateUndoState();
      renderLista(list);
      renderDashboard(list);
      renderSidebarCounts(list);
      renderDetalhe(list);
    }
    closeClose();
  });
  userBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    userWrap?.classList.toggle('open');
    const expanded = userWrap?.classList.contains('open');
    userBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  });
  document.addEventListener('click', (e) => {
    if (!userWrap?.contains(e.target)) userWrap?.classList.remove('open');
  });
  userMenu?.addEventListener('click', (e) => {
    const b = e.target.closest('.user-item');
    if (!b) return;
    const action = b.dataset.action;
    if (action === 'dashboard') {
      document.querySelector('.tab[data-tab="dashboard"]')?.click();
    } else if (action === 'meus-dados') {
      alert('Meus Dados: recurso em construção.');
    } else if (action === 'relatorio') {
      alert('Relatório de Acesso: recurso em construção.');
    } else if (action === 'senha') {
      alert('Alteração de Senha: recurso em construção.');
    } else if (action === 'logout') {
      if (confirm('Deseja efetuar logout?')) {
        localStorage.clear();
        location.reload();
      }
    }
    userWrap?.classList.remove('open');
  });
  function closeDrawer() {
    drawer?.classList.remove('open');
    backdrop?.classList.remove('show');
    backdrop?.setAttribute('hidden', 'hidden');
    if (toggle) {
      toggle.textContent = '\u2630';
      toggle.setAttribute('aria-label', 'Abrir menu');
      toggle.classList.remove('is-open');
    }
  }
  function openDrawer() {
    drawer?.classList.add('open');
    backdrop?.classList.add('show');
    backdrop?.removeAttribute('hidden');
    if (toggle) {
      toggle.textContent = '\u2715';
      toggle.setAttribute('aria-label', 'Fechar menu');
      toggle.classList.add('is-open');
    }
  }
  toggle?.addEventListener('click', () => {
    if (drawer?.classList.contains('open')) closeDrawer(); else openDrawer();
  });
  backdrop?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (imgViewer && !imgViewer.classList.contains('hidden')) closeImage();
      else if (closeDlg && !closeDlg.classList.contains('hidden')) closeClose();
      else if (replyDlg && !replyDlg.classList.contains('hidden')) closeReply();
      else closeDrawer();
    }
  });
  const logo = document.querySelector('.drawer-logo');
  const appbar = document.querySelector('.appbar');
  const toTopBtn = document.getElementById('to-top');
  function updateLogoVisibility() {
    const scrolled = window.scrollY > 10;
    if (logo) {
      if (scrolled) logo.classList.add('hide'); else logo.classList.remove('hide');
    }
    if (appbar) {
      if (scrolled) appbar.classList.add('hide'); else appbar.classList.remove('hide');
    }
    if (toTopBtn) {
      if (window.scrollY > 300) toTopBtn.classList.add('show'); else toTopBtn.classList.remove('show');
    }
  }
  window.addEventListener('scroll', updateLogoVisibility, { passive: true });
  updateLogoVisibility();
  toTopBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  const initialList = loadTickets();
  // Restaurar preferências de UI
  const prefs = loadUIState();
  const auth0 = loadAuth();
  applyAuthUI(auth0 || null);
  if (!auth0) {
    const loginDlg0 = document.getElementById('login-dialog');
    loginDlg0?.classList.remove('hidden');
  }
  if (prefs.tab) {
    const tabEl = document.querySelector(`.tab[data-tab="${prefs.tab}"]`);
    tabEl?.click();
  }
  if (prefs.filter) {
    setFilter(prefs.filter);
  }
  if (Number.isInteger(prefs.page)) {
    page = prefs.page;
  }
  renderLista(initialList);
  renderDashboard(initialList);
  renderSidebarCounts(initialList);
  const filtrosInit = document.getElementById('filtros');
  if (filtrosInit) filtrosInit.style.display = adminMode ? '' : 'none';
}

document.addEventListener('DOMContentLoaded', main);

function setFilter(f) {
  filterState = f;
  page = 1;
  // Marca apenas os chips do header; não aplicar 'active' em todos os itens da sidebar
  document.querySelectorAll('#filtros .chip[data-filter]').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === f);
  });
  saveUIState({ filter: f, page });
  renderLista(loadTickets());
}

function openTour() {
  const t = document.getElementById('tour');
  if (!t) return;
  t.classList.remove('hidden');
  showTourStep(1);
}

function closeTour() {
  const t = document.getElementById('tour');
  if (!t) return;
  t.classList.add('hidden');
}

function showTourStep(n) {
  document.querySelectorAll('.tour-step').forEach(s => s.classList.add('hidden'));
  const step = document.querySelector(`.tour-step[data-step="${n}"]`);
  step?.classList.remove('hidden');
}

function updateUndoState() {
  const u = document.getElementById('undo');
  if (u) u.disabled = !lastAction;
}

function undoLast() {
  if (!lastAction) return;
  const list = loadTickets();
  if (lastAction.type === 'create') {
    const idx = list.findIndex(x => x.id === lastAction.id);
    if (idx !== -1) list.splice(idx, 1);
  } else if (lastAction.type === 'status') {
    const idx = list.findIndex(x => x.id === lastAction.before.id);
    if (idx !== -1) list[idx] = lastAction.before;
  } else if (lastAction.type === 'delete') {
    list.push(lastAction.before);
    list.sort((a, b) => a.id - b.id);
  }
  saveTickets(list);
  lastAction = null;
  updateUndoState();
  renderLista(list);
  renderDashboard(list);
}

function computeStats(list) {
  const total = list.length;
  const abertos = list.filter(t => t.status === 'ABERTO').length;
  const em = list.filter(t => t.status === 'EM_ANDAMENTO').length;
  const fechados = list.filter(t => t.status === 'FECHADO').length;
  const taxares = total ? Math.round((fechados / total) * 1000) / 10 : 0;
  const now = Date.now();
  const last24h = list.filter(t => now - new Date(t.atualizadoEm).getTime() < 24 * 60 * 60 * 1000).length;
  const perHour = Array(24).fill(0);
  const perWeekday = Array(7).fill(0);
  for (const t of list) {
    const d = new Date(t.criadoEm);
    perHour[d.getHours()]++;
    perWeekday[d.getDay()]++;
  }
  return { total, abertos, em, fechados, taxares, last24h, perHour, perWeekday };
}

function renderDashboard(list) {
  const s = computeStats(list);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('kpi-total', s.total);
  set('kpi-abertos', s.abertos);
  set('kpi-em', s.em);
  set('kpi-fechados', s.fechados);
  set('kpi-taxares', `${s.taxares}%`);
  set('kpi-24h', s.last24h);
  const hour = document.getElementById('chart-hour');
  const hourLabels = document.getElementById('chart-hour-labels');
  const wd = document.getElementById('chart-weekday');
  const wdLabels = document.getElementById('chart-weekday-labels');
  if (hour && hourLabels) {
    hour.innerHTML = ''; hourLabels.innerHTML = '';
    const max = Math.max(1, ...s.perHour);
    for (let h = 0; h < 24; h++) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = `${(s.perHour[h] / max) * 100}%`;
      hour.appendChild(bar);
      const lbl = document.createElement('div');
      lbl.textContent = String(h).padStart(2, '0');
      hourLabels.appendChild(lbl);
    }
  }
  if (wd && wdLabels) {
    wd.innerHTML = ''; wdLabels.innerHTML = '';
    const max = Math.max(1, ...s.perWeekday);
    const names = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    for (let d = 0; d < 7; d++) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = `${(s.perWeekday[d] / max) * 100}%`;
      wd.appendChild(bar);
      const lbl = document.createElement('div');
      lbl.textContent = names[d];
      wdLabels.appendChild(lbl);
    }
  }
}

function renderDetalhe(list) {
  const pane = document.getElementById('detalhe');
  if (!pane) return;
  pane.innerHTML = '';
  const t = list.find(x => x.id === selectedTicketId);
  if (!t) {
    pane.innerHTML = '<div class="vazio">Selecione um chamado para ver os detalhes</div>';
    return;
  }
  const header = document.createElement('div');
  header.className = 'ticket';
  const head = document.createElement('div');
  head.className = 'ticket-head';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = `${t.id} — ${t.titulo}`;
  const status = document.createElement('div');
  status.className = `status ${t.status}`;
  status.textContent = statusLabel(t.status);
  head.appendChild(title);
  head.appendChild(status);
  const body = document.createElement('div');
  body.className = 'ticket-body';
  if (t.descricao) {
    const d = document.createElement('div');
    d.textContent = t.descricao;
    body.appendChild(d);
  }
  if (t.setor) {
    const l1 = document.createElement('div');
    l1.textContent = `Setor: ${t.setor}`;
    body.appendChild(l1);
  }
  if (t.solicitante) {
    const l2 = document.createElement('div');
    l2.textContent = `Solicitante: ${t.solicitante}`;
    body.appendChild(l2);
  }
  const meta2 = document.createElement('div');
  meta2.className = 'ticket-meta';
  const created = t.criadoEm ? `Criado: ${formatDate(t.criadoEm)}` : '';
  const updated = t.atualizadoEm ? `Atualizado: ${formatDate(t.atualizadoEm)}` : '';
  const closed = t.closedAt ? `Fechado${t.closedBy ? ` por ${t.closedBy}` : ''}: ${formatDate(t.closedAt)}` : '';
  meta2.textContent = [created, updated, closed].filter(Boolean).join(' — ');
  body.appendChild(meta2);
  header.appendChild(head);
  header.appendChild(body);
  // Replies list (show all)
  if (Array.isArray(t.comentarios) && t.comentarios.length) {
    const replies = document.createElement('div');
    replies.style.display = 'grid';
    replies.style.gap = '8px';
    t.comentarios.forEach(c => {
      const r = document.createElement('div');
      r.className = 'ticket-reply';
      const who = c.autor === 'admin' ? 'Atendente' : 'Solicitante';
      const when = c.em ? ` — ${formatDate(c.em)}` : '';
      const txt = document.createElement('div');
      txt.className = 'text';
      txt.textContent = `${who}: ${c.mensagem || '(sem mensagem)'}${when}`;
      r.appendChild(txt);
      if ((c.mensagem || '').length > 150) {
        const topMore = document.createElement('button');
        topMore.className = 'btn-glass';
        topMore.textContent = 'Ver mais';
        topMore.style.alignSelf = 'flex-end';
        topMore.style.display = 'none';
        const bottomMore = document.createElement('button');
        bottomMore.className = 'btn-glass';
        bottomMore.textContent = 'Ver mais';
        const toggle = (e) => {
          e.stopPropagation();
          const exp = r.classList.toggle('expanded');
          const label = exp ? 'Ver menos' : 'Ver mais';
          topMore.textContent = label;
          bottomMore.textContent = label;
          topMore.style.display = exp ? '' : 'none';
        };
        topMore.addEventListener('click', toggle);
        bottomMore.addEventListener('click', toggle);
        r.appendChild(bottomMore);
        r.insertBefore(topMore, txt);
      }
      if (Array.isArray(c.anexos) && c.anexos.length) {
        c.anexos.forEach(ax => {
          if ((ax.type === 'image/jpeg' || ax.type === 'image/png') && ax.dataUrl) {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'img-thumb';
            link.dataset.src = ax.dataUrl;
            const img = document.createElement('img');
            img.src = ax.dataUrl;
            img.alt = ax.name || 'anexo';
            link.appendChild(img);
            r.appendChild(link);
          }
        });
      }
      replies.appendChild(r);
    });
    header.appendChild(replies);
  }
  const actions = document.createElement('div');
  actions.className = 'ticket-actions';
  const opts = adminMode ? ['ABERTO','EM_ANDAMENTO','FECHADO'] : [];
  opts.forEach(st => {
    if (st === t.status) return;
    const b = document.createElement('button');
    b.textContent = st === 'ABERTO' ? 'Reabrir' : st === 'EM_ANDAMENTO' ? 'Responder Chamado' : 'Fechar';
    b.addEventListener('click', () => {
      if (adminMode && st === 'EM_ANDAMENTO') { openReply(t.id, 'admin'); return; }
      const list2 = loadTickets();
      const idx = list2.findIndex(x => x.id === t.id);
      if (idx !== -1) {
        const before = { ...list2[idx] };
        if (adminMode && st === 'FECHADO') { openClose(t.id); return; }
        const nowIso = new Date().toISOString();
        if (before.status === 'FECHADO') { delete list2[idx].closedAt; delete list2[idx].closedBy; }
        list2[idx].status = st;
        list2[idx].atualizadoEm = nowIso;
        saveTickets(list2);
        lastAction = { type: 'status', before, after: { ...list2[idx] } };
        updateUndoState();
        renderLista(list2);
        renderDashboard(list2);
        renderSidebarCounts(list2);
      }
    });
    actions.appendChild(b);
  });
  pane.appendChild(header);
  pane.appendChild(actions);
}

function renderFooter(total) {
  const ids = ['lista-header','lista-footer'];
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, page * PAGE_SIZE);
  const maxPage = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_SIZE));
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (total <= 0) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    el.style.display = '';
    el.innerHTML = '';
    const summary = document.createElement('div');
    summary.className = 'summary';
    summary.textContent = `Mostrando ${start}-${end} de ${total}`;
    el.appendChild(summary);
    if (id === 'lista-footer') {
      const pager = document.createElement('div');
      pager.className = 'pager';
      const prev = document.createElement('button');
      prev.className = 'btn-glass';
      prev.textContent = 'Anterior';
      prev.disabled = page === 1;
      prev.addEventListener('click', () => {
        if (page > 1) {
          page -= 1;
          saveUIState({ page });
          renderLista(loadTickets());
          document.getElementById('lista')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      });
      const next = document.createElement('button');
      next.className = 'btn-glass';
      next.textContent = 'Próximo';
      next.disabled = page >= maxPage;
      next.addEventListener('click', () => {
        if (page < maxPage) {
          page += 1;
          saveUIState({ page });
          renderLista(loadTickets());
          document.getElementById('lista')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      });
      pager.appendChild(prev);
      pager.appendChild(next);
      el.appendChild(pager);
    }
  });
}

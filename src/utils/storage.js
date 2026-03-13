export const STORAGE_KEY = 'tickets.v1';

export function loadTickets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTickets(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function nextId(list) {
  return list.length ? Math.max(...list.map(t => t.id)) + 1 : 1;
}

export function updateTicket(id, updates) {
  const list = loadTickets();
  const idx = list.findIndex(t => t.id === id);
  if (idx !== -1) {
    const old = list[idx];
    const updated = { ...old, ...updates, atualizadoEm: new Date().toISOString() };
    
    // Handle closedBy logic if status changing to CLOSED
    if (updates.status === 'FECHADO' && updates.closedBy) {
      updated.closedAt = new Date().toISOString();
    } else if (old.status === 'FECHADO' && updates.status !== 'FECHADO') {
      delete updated.closedAt;
      delete updated.closedBy;
    }

    list[idx] = updated;
    saveTickets(list);
    return true;
  }
  return false;
}

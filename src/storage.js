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

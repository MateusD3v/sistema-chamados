export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = (now - d) / 1000; // seconds
  if (diff < 60) return 'Agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function statusLabel(s) {
  switch (s) {
    case 'ABERTO': return 'Aberto';
    case 'EM_ANDAMENTO': return 'Em andamento';
    case 'FECHADO': return 'Fechado';
    default: return s;
  }
}

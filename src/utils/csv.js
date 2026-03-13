function detectDelimiter(headerLine) {
  const comma = (headerLine.match(/,/g) || []).length;
  const semi = (headerLine.match(/;/g) || []).length;
  return semi > comma ? ';' : ',';
}
export function ticketsToCSV(list) {
  const sep = ';';
  const cols = ['id','titulo','descricao','setor','solicitante','status','criadoEm','atualizadoEm','firstResponseAt','closedAt','closedBy'];
  const esc = (v='') => `"${String(v).replace(/"/g,'""')}"`;
  const lines = [cols.join(sep)];
  for (const t of list) {
    lines.push([
      esc(t.id),
      esc(t.titulo),
      esc(t.descricao),
      esc(t.setor || ''),
      esc(t.solicitante || ''),
      esc(t.status),
      esc(t.criadoEm),
      esc(t.atualizadoEm),
      esc(t.firstResponseAt || ''),
      esc(t.closedAt || ''),
      esc(t.closedBy || ''),
    ].join(sep));
  }
  return lines.join('\r\n');
}
export function parseCSV(text) {
  const firstNL = text.indexOf('\n');
  const headerLine = firstNL !== -1 ? text.slice(0, firstNL) : text;
  const DELIM = detectDelimiter(headerLine);
  const rows = [];
  let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i+1] === '"') { cell += '"'; i++; }
        else { inQuotes = false; }
      } else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === DELIM) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  const idx = (k) => header.indexOf(k);
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols.length || cols.every(c => c === '')) continue;
    const get = (k) => cols[idx(k)] ?? '';
    out.push({
      id: Number(get('id')) || undefined,
      titulo: get('titulo'),
      descricao: get('descricao'),
      setor: get('setor'),
      solicitante: get('solicitante'),
      status: get('status') || 'ABERTO',
      criadoEm: get('criadoEm') || new Date().toISOString(),
      atualizadoEm: get('atualizadoEm') || get('criadoEm') || new Date().toISOString(),
      firstResponseAt: get('firstResponseAt') || undefined,
      closedAt: get('closedAt') || undefined,
      closedBy: get('closedBy') || undefined,
    });
  }
  return out;
}

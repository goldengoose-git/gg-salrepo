import type { Parsed } from './importer';

// Jira exports use either ',' or ';' depending on locale. Preserve quoted newlines.
function rowsOf(src: string, sep: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false;
  const s = src.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (quoted && s[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || !field) quoted = !quoted;
      else field += c;
    } else if (c === sep && !quoted) { row.push(field); field = ''; }
    else if (c === '\n' && !quoted) { row.push(field); if (row.some((v) => v.trim())) rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (quoted) throw new Error('CSV non valido: virgolette non chiuse.');
  row.push(field); if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
export function parseJiraCsv(text: string): Parsed {
  if (text.length > 4 * 1024 * 1024) throw new Error('CSV troppo grande (max 4 MB).');
  const first = text.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
  const n = (sep: string) => rowsOf(first, sep)[0]?.length ?? 0;
  const sep = n(';') > n(',') ? ';' : ',';
  const [header, ...data] = rowsOf(text, sep);
  if (!header) throw new Error('CSV vuoto.');
  const cols = header.map(norm);
  const col = (...names: string[]) => cols.findIndex((h) => names.includes(h));
  const key = col('issue key', 'key', 'chiave', 'chiave problema', 'chiave ticket');
  const title = col('summary', 'riepilogo', 'sommario', 'oggetto', 'subject');
  if (key < 0 || title < 0) throw new Error('CSV Jira: servono le colonne Issue key (o Key) e Summary (o Riepilogo).');
  const assignee = col('assignee', 'assegnatario', 'assegnato a');
  const priority = col('priority', 'priorità', 'priorita');
  const status = col('status', 'stato');
  const created = col('created', 'created date', 'creato', 'data creazione');
  const at = (r: string[], i: number) => (i < 0 ? '' : (r[i] || '').trim().slice(0, 2000));
  const seen = new Set<string>();
  const items: Parsed['items'] = [];
  for (const r of data) {
    const code = at(r, key), description = at(r, title);
    if (!code && !description) continue;
    if (!code || !description) throw new Error(`CSV Jira: riga ${items.length + 2} senza Issue key o Summary.`);
    if (!/^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(code)) throw new Error(`Issue key non valida: ${code}`);
    if (seen.has(code.toUpperCase())) continue;
    seen.add(code.toUpperCase());
    const jiraStatus = at(r, status);
    const st = norm(jiraStatus);
    const mapped = /^(done|closed|resolved|completed|completato|completata|chiuso|chiusa|risolto|risolta)$/.test(st) ? 'completed'
      : /^(blocked|bloccato|bloccata)$/.test(st) ? 'blocked'
      : /^(on hold|onhold|in pausa|sospeso|sospesa)$/.test(st) ? 'onhold'
      : /^(delayed|in ritardo)$/.test(st) ? 'delay' : 'ontrack';
    items.push({ area: 'AMS', code, description, owner: at(r, assignee), priority: at(r, priority),
      requested_date: at(r, created), activity: jiraStatus, status: mapped, archived: mapped === 'completed' });
  }
  if (!items.length) throw new Error('CSV Jira: nessun ticket valido.');
  return { deck: {}, items, bars: [] };
}

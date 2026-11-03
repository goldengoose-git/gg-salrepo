import { STATUS_KEYS, type Area, type Status } from './constants';
import type { ImpItem } from './importer';

export const CSV_COLS = ['Area', 'Codice', 'Type', 'Descrizione', 'Priorità', 'Data richiesta', 'Go-live', 'Owner', 'Stima', 'Contratto', 'Attività', 'Stato', 'Archiviata'] as const;

const esc = (v: any) => {
  const s = String(v ?? '');
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** CSV con separatore ";" (Excel italiano) e BOM UTF-8. */
export function toCsv(rows: any[][]) {
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n') + '\r\n';
}

/** Parser CSV (virgolette, a capo nei campi, separatore ; , o tab riconosciuto dalla prima riga). */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  const cnt = (c: string) => first.split(c).length - 1;
  const sep = cnt(';') >= cnt(',') && cnt(';') >= cnt('\t') ? ';' : cnt(',') >= cnt('\t') ? ',' : '\t';
  const rows: string[][] = [];
  let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const H: Record<string, keyof ImpItem | 'archived'> = {
  area: 'area', codice: 'code', code: 'code', ticket: 'code', type: 'type', tipo: 'type', descrizione: 'description', description: 'description',
  priorita: 'priority', priority: 'priority', datarichiesta: 'requested_date', requested: 'requested_date', requesteddate: 'requested_date',
  golive: 'golive_date', golivedate: 'golive_date', owner: 'owner', stima: 'estimate', estimate: 'estimate', contratto: 'contract', contract: 'contract',
  attivita: 'activity', activity: 'activity', stato: 'status', status: 'status', archiviata: 'archived', archived: 'archived',
};
const STATUS_IT: Record<string, Status> = {
  ontrack: 'ontrack', intempo: 'ontrack', delay: 'delay', ritardo: 'delay', blocked: 'blocked', bloccato: 'blocked', onhold: 'onhold', insospeso: 'onhold', completed: 'completed', completato: 'completed', done: 'completed',
};

export function csvToItems(text: string, defaultArea: Area): ImpItem[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV vuoto o senza righe di dati.');
  const cols = rows[0].map((h) => H[norm(h)]);
  if (!cols.includes('description')) throw new Error('CSV non riconosciuto: manca la colonna "Descrizione".');
  const out: ImpItem[] = [];
  for (const r of rows.slice(1)) {
    const it: any = { area: defaultArea };
    cols.forEach((k, i) => {
      if (!k) return;
      const v = (r[i] ?? '').trim();
      if (k === 'area') { const a = v.toUpperCase(); if (['MC', 'SC', 'AMS'].includes(a)) it.area = a; }
      else if (k === 'status') { const s = STATUS_IT[norm(v)] ?? ((STATUS_KEYS as string[]).includes(v) ? (v as Status) : undefined); if (s) it.status = s; }
      else if (k === 'archived') it.archived = /^(si|sì|s|yes|y|1|true|x)$/i.test(v);
      else it[k] = v;
    });
    if (!it.description && !it.code) continue;
    out.push(it);
  }
  return out;
}

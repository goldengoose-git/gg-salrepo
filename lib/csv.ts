import { AMS_KEYS, PRIORITIES, STATUS_KEYS, jiraStatus, type AmsStatus, type Area, type Status } from './constants';
import type { ImpItem } from './importer';

export const CSV_COLS = ['Area', 'Codice', 'Type', 'Descrizione', 'Priorità', 'Data richiesta', 'Go-live', 'Data di rilascio', 'Owner', 'Stima', 'Contratto', 'Attività', 'Stato', 'Stato AMS', 'Archiviata'] as const;

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
const H: Record<string, keyof ImpItem> = {
  area: 'area', codice: 'code', code: 'code', ticket: 'code', type: 'type', tipo: 'type', descrizione: 'description', description: 'description',
  priorita: 'priority', priority: 'priority', datarichiesta: 'requested_date', requested: 'requested_date', requesteddate: 'requested_date',
  golive: 'golive_date', golivedate: 'golive_date', datadirilascio: 'release_date', rilascio: 'release_date', releasedate: 'release_date', statoams: 'ams_status', amsstatus: 'ams_status', owner: 'owner', stima: 'estimate', estimate: 'estimate', contratto: 'contract', contract: 'contract',
  attivita: 'activity', activity: 'activity', stato: 'status', status: 'status', archiviata: 'archived', archived: 'archived',
};
const STATUS_IT: Record<string, Status> = {
  ontrack: 'ontrack', intempo: 'ontrack', delay: 'delay', ritardo: 'delay', blocked: 'blocked', bloccato: 'blocked', onhold: 'onhold', insospeso: 'onhold', completed: 'completed', completato: 'completed', done: 'completed',
};

export function csvToItems(text: string, defaultArea: Area): ImpItem[] {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV vuoto o senza righe di dati.');
  if (isJira(rows[0])) return jiraToItems(rows).items;
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
      else if (k === 'ams_status') { const a = jiraStatus(v); if (a) it.ams_status = a; }
      else it[k] = v;
    });
    if (!it.description && !it.code) continue;
    out.push(it);
  }
  return out;
}

// ---------- Jira ----------
const MON: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/** "09/Jun/25 6:37 PM" (export Jira) oppure "2025-06-09 18:37" -> Date | null */
export function parseJiraDate(v: string): Date | null {
  const t = v.trim();
  let m = t.match(/^(\d{1,2})\/(\w{3})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?)?$/i);
  if (m && MON[m[2].toLowerCase()] !== undefined) {
    let y = +m[3]; if (y < 100) y += 2000;
    let h = m[4] ? +m[4] : 0; if (m[6]) { h = h % 12 + (/pm/i.test(m[6]) ? 12 : 0); }
    return new Date(Date.UTC(y, MON[m[2].toLowerCase()], +m[1], h, m[5] ? +m[5] : 0));
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return new Date(Date.UTC(y, +m[2] - 1, +m[1])); }
  return null;
}
const dmy = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCFullYear()).slice(2)}`;

export const isJira = (header: string[]) => {
  const n = header.map(norm);
  return n.includes('issuekey') && n.includes('summary') && n.includes('status');
};
export type JiraResult = { items: ImpItem[]; unknownStatuses: Record<string, number> };

/** Export CSV di Jira -> ticket AMS. Issue key = codice, Summary = subject, Reporter/Assignee = owner, Created = Opened. */
export function jiraToItems(rows: string[][]): JiraResult {
  const h = rows[0].map(norm);
  const ix = (...names: string[]) => h.findIndex((x) => names.includes(x));
  const iKey = ix('issuekey'), iSum = ix('summary'), iSt = ix('status'), iPr = ix('priority'), iRep = ix('reporter'), iAss = ix('assignee'),
    iCr = ix('created'), iUp = ix('updated', 'resolved');
  const items: ImpItem[] = [];
  const unknown: Record<string, number> = {};
  for (const r of rows.slice(1)) {
    const code = (r[iKey] ?? '').trim();
    if (!code) continue;
    const rawSt = (r[iSt] ?? '').trim();
    let am: AmsStatus | null = jiraStatus(rawSt);
    if (!am) { unknown[rawSt || '(vuoto)'] = (unknown[rawSt || '(vuoto)'] ?? 0) + 1; am = 'new'; }
    const pr = (r[iPr] ?? '').trim();
    const prio = PRIORITIES.find((p) => p.toLowerCase() === pr.toLowerCase()) ?? (/^(critical|blocker)$/i.test(pr) ? 'Highest' : /^(major)$/i.test(pr) ? 'High' : /^(minor)$/i.test(pr) ? 'Low' : pr);
    const created = iCr >= 0 ? parseJiraDate(r[iCr] ?? '') : null;
    const updated = iUp >= 0 ? parseJiraDate(r[iUp] ?? '') : null;
    items.push({
      area: 'AMS', code, description: (r[iSum] ?? '').trim(), priority: prio,
      owner: ((iAss >= 0 ? r[iAss] : '') || (iRep >= 0 ? r[iRep] : '') || '').trim(),
      requested_date: created ? dmy(created) : '', ams_status: am, archived: am === 'done',
      closed_at: am === 'done' && updated ? updated.toISOString() : '',
    });
  }
  return { items, unknownStatuses: unknown };
}

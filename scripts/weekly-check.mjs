#!/usr/bin/env node
// Controllo settimanale di coerenza dei dati del SAL Builder (nessuna dipendenza, Node 18+).
//
//  Scarica i backup e li verifica:
//    SAL_URL=https://tuo-progetto.vercel.app BACKUP_TOKEN=... node scripts/weekly-check.mjs
//  Oppure verifica file gia scaricati a mano da Admin All > Backup e ripristino:
//    node scripts/weekly-check.mjs --file SAL_backup_completo_2026-11-03.json [--db SAL_DB_completo_2026-11-03.json.gz]
//
//  Output in ./backups/AAAA-MM-GG/ (o --out cartella): i file scaricati, report.md e report.json.
//  Il confronto con l'ultimo controllo precedente segnala voci sparite, settimane nuove e variazioni dei conteggi.
//  Codice di uscita: 0 = nessun errore (possono esserci avvisi), 1 = errori di coerenza, 2 = errore di utilizzo/download.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const today = new Date().toISOString().slice(0, 10);
const outRoot = arg('--out') ?? 'backups';
const outDir = join(outRoot, today);
mkdirSync(outDir, { recursive: true });

const die = (m) => { console.error('ERRORE: ' + m); process.exit(2); };
const readJson = (p) => {
  const buf = readFileSync(p);
  const txt = (buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf).toString('utf8').replace(/^﻿/, '');
  return JSON.parse(txt);
};

// ---------- 1. ottieni i file ----------
let backupPath = arg('--file');
let dbPath = arg('--db');
if (!backupPath) {
  const base = (process.env.SAL_URL ?? '').replace(/\/+$/, '');
  const token = process.env.BACKUP_TOKEN;
  if (!base || !token) die('imposta SAL_URL e BACKUP_TOKEN (token configurato anche su Vercel), oppure usa --file <backup.json>');
  const get = async (path, dest) => {
    const r = await fetch(base + path, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) die(`download ${path} fallito: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`);
    writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    console.log('Scaricato', dest);
    return dest;
  };
  backupPath = await get('/api/export/backup', join(outDir, `SAL_backup_completo_${today}.json`));
  dbPath = await get('/api/admin/backup-db', join(outDir, `SAL_DB_completo_${today}.json.gz`));
}
if (!existsSync(backupPath)) die('file non trovato: ' + backupPath);

// ---------- 2. carica ----------
const raw = readJson(backupPath);
let B;
if (raw.format === 'sal-builder-backup') B = { decks: raw.decks, items: raw.items, bars: raw.bars, lookups: raw.lookups, settings: raw.settings, snapshots: raw.snapshots, team_status: raw.team_status ?? [], counts: raw.counts };
else if (raw.format === 'sal-builder-db-dump') B = { decks: raw.tables.decks, items: raw.tables.items, bars: raw.tables.pipeline_bars, lookups: raw.tables.lookups, settings: raw.tables.settings, snapshots: raw.tables.snapshots, team_status: raw.tables.team_status ?? [], counts: raw.counts };
else die('formato file non riconosciuto (atteso sal-builder-backup o sal-builder-db-dump)');
for (const k of ['decks', 'items', 'bars', 'lookups', 'settings', 'snapshots']) B[k] ??= [];

const errors = [], warns = [], info = [];
const E = (m) => errors.push(m);
const W = (m) => warns.push(m);
const sample = (a, n = 5) => a.slice(0, n).join(', ') + (a.length > n ? `, … (+${a.length - n})` : '');

// ---------- 3. controlli ----------
const AREAS = ['MC', 'SC', 'AMS'], STATUSES = ['ontrack', 'delay', 'blocked', 'onhold', 'completed'];
const AMS = { new: 'ontrack', wip: 'ontrack', testing: 'ontrack', ready: 'ontrack', waiting: 'delay', done: 'completed' };
const LANES = ['SFMC', 'CROSS', 'SFSC'], BARST = ['completed', 'wip', 'analysis', 'estimate'];
const PRIOS = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

// 3.1 conteggi dichiarati e id duplicati
if (B.counts) for (const [k, arr] of [['decks', B.decks], ['items', B.items], ['bars', B.bars], ['snapshots', B.snapshots]])
  if (B.counts[k] !== undefined && B.counts[k] !== arr.length) E(`Conteggio ${k}: dichiarato ${B.counts[k]}, nel file ${arr.length}`);
for (const [k, arr] of [['decks', B.decks], ['items', B.items], ['bars', B.bars]]) {
  const seen = new Set(), dup = [];
  for (const r of arr) { if (seen.has(r.id)) dup.push(r.id); seen.add(r.id); }
  if (dup.length) E(`${k}: id duplicati (${sample(dup)})`);
}

// 3.2 settimane
const decks = [...B.decks].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
const deckById = new Map(decks.map((d) => [d.id, d]));
const latest = decks[decks.length - 1];
if (!latest) E('Nessuna settimana (deck) nel backup');
const wk = new Map();
for (const d of decks) wk.set(d.week_label, (wk.get(d.week_label) ?? 0) + 1);
for (const [w, n] of wk) if (n > 1) W(`Settimana "${w}" presente ${n} volte`);

// 3.3 voci
const orphan = B.items.filter((i) => !deckById.has(i.deck_id));
if (orphan.length) E(`${orphan.length} voci senza settimana (deck_id inesistente): ${sample(orphan.map((i) => i.code || i.id.slice(0, 8)))}`);
const bad = (cond, msg, pick = (i) => `${i.area}:${i.code || i.id.slice(0, 8)}`) => { const l = B.items.filter(cond); if (l.length) E(`${l.length} voci: ${msg} (${sample(l.map(pick))})`); };
bad((i) => !AREAS.includes(i.area), 'area non valida');
bad((i) => !STATUSES.includes(i.status), 'status non valido');
bad((i) => !String(i.description ?? '').trim(), 'descrizione vuota');
bad((i) => i.area === 'AMS' && !Object.hasOwn(AMS, i.ams_status), 'ticket AMS senza stato Jira valido (ams_status)');
bad((i) => i.area === 'AMS' && Object.hasOwn(AMS, i.ams_status) && AMS[i.ams_status] !== i.status, 'status non coerente con lo stato Jira (es. Done deve essere completed, Waiting delay)');
bad((i) => i.status !== 'completed' && (i.archived_at || i.closed_at), 'archiviate/chiuse ma non Completed (regola: cambio stato azzera archived_at e closed_at)');
bad((i) => i.archived_at && i.status !== 'completed', 'in archivio ma non Completed');
const w1 = B.items.filter((i) => i.status === 'completed' && !i.closed_at && !i.archived_at);
if (w1.length) W(`${w1.length} voci Completed senza closed_at né archived_at (${sample(w1.map((i) => i.code || i.id.slice(0, 8)))})`);
const w2 = B.items.filter((i) => latest && i.deck_id !== latest.id && i.status === 'completed' && !i.archived_at);
if (w2.length) W(`${w2.length} voci Completed ancora attive in settimane precedenti (dopo "Nuova settimana" dovrebbero essere archiviate): ${sample(w2.map((i) => i.code || i.id.slice(0, 8)))}`);
const w3 = B.items.filter((i) => i.area !== 'AMS' && i.ams_status);
if (w3.length) W(`${w3.length} voci MC/SC con ams_status valorizzato`);
const w4 = B.items.filter((i) => i.priority && !PRIOS.includes(i.priority));
if (w4.length) W(`${w4.length} voci con priorità fuori elenco (${sample([...new Set(w4.map((i) => i.priority))])})`);
const w5 = B.items.filter((i) => i.estimate && i.estimate !== '-' && !/^\d+(\.\d+)?$/.test(i.estimate));
if (w5.length) W(`${w5.length} voci con stima non numerica (${sample([...new Set(w5.map((i) => i.estimate))])})`);
const w6 = B.items.filter((i) => i.area === 'AMS' && !/^[A-Z]{1,6}-\d+$/.test(i.code ?? ''));
if (w6.length) W(`${w6.length} ticket AMS con codice mancante o anomalo (${sample(w6.map((i) => i.code || i.id.slice(0, 8)))})`);
// codici AMS duplicati nella stessa settimana
const codes = new Map();
for (const i of B.items) if (i.area === 'AMS' && i.code) { const k = i.deck_id + '|' + i.code; codes.set(k, (codes.get(k) ?? 0) + 1); }
const dupc = [...codes].filter(([, n]) => n > 1).map(([k]) => k.split('|')[1]);
if (dupc.length) E(`Ticket AMS duplicati nella stessa settimana: ${sample(dupc)}`);
// posizioni duplicate tra le voci attive
const pos = new Map();
for (const i of B.items) if (!i.archived_at) { const k = `${i.deck_id}|${i.area}|${i.position}`; pos.set(k, (pos.get(k) ?? 0) + 1); }
const dupp = [...pos].filter(([, n]) => n > 1);
if (dupp.length) W(`${dupp.length} posizioni duplicate tra voci attive (l'ordine in tabella puo risultare instabile)`);

// 3.4 elenchi e label data (settimana corrente)
const lk = new Map();
for (const l of B.lookups) { const k = `${l.kind}|${l.value}`; lk.set(k, (lk.get(k) ?? 0) + 1); }
const dupl = [...lk].filter(([, n]) => n > 1).map(([k]) => k);
if (dupl.length) E(`Elenchi: valori duplicati (${sample(dupl)})`);
const have = (kind) => new Set(B.lookups.filter((l) => l.kind === kind).map((l) => l.value));
const cur = latest ? B.items.filter((i) => i.deck_id === latest.id && !i.archived_at) : [];
for (const [area, kind] of [['MC', 'type_mc'], ['SC', 'type_sc']]) {
  const set = have(kind);
  const miss = [...new Set(cur.filter((i) => i.area === area && i.type && !set.has(i.type)).map((i) => i.type))];
  if (set.size && miss.length) W(`Type ${area} usati ma non in elenco: ${sample(miss)}`);
}
const MONTH_LONG = /\b(sept|september|june|july|january|february|march|april|august|october|november|december|beginning|begin|middle)\b/i;
const unnorm = [];
for (const i of cur) for (const f of ['requested_date', 'golive_date', 'release_date']) if (MONTH_LONG.test(i[f] ?? '')) unnorm.push(`${i.code || i.area}:${i[f]}`);
if (unnorm.length) W(`${unnorm.length} label data non normalizzate nella settimana corrente (usa Admin All > Normalizza date): ${sample(unnorm)}`);

// 3.5 timeline
const barBad = [];
for (const b of B.bars) {
  const s = Number(b.start_m), e = Number(b.end_m);
  if (!deckById.has(b.deck_id)) E(`Barra "${b.label}" senza settimana`);
  if (!LANES.includes(b.lane) || !BARST.includes(b.status)) barBad.push(b.label);
  else if (!(s >= 0 && e <= 12 && e > s)) barBad.push(`${b.label} (${s}-${e})`);
}
if (barBad.length) E(`${barBad.length} barre timeline non valide: ${sample(barBad)}`);
const rows = new Map();
for (const b of B.bars) { const k = `${b.deck_id}|${b.lane}|${b.row}`; (rows.get(k) ?? rows.set(k, []).get(k)).push(b); }
let ov = 0;
for (const l of rows.values()) { l.sort((a, b) => a.start_m - b.start_m); for (let i = 1; i < l.length; i++) if (Number(l[i].start_m) < Number(l[i - 1].end_m)) ov++; }
if (ov) W(`${ov} sovrapposizioni di barre sulla stessa riga (il layout le sposta da solo)`);

// 3.6 impostazioni
for (const s of B.settings) if (s.key === 'ui_colors') { try { JSON.parse(s.value); } catch { E('Impostazione ui_colors non e un JSON valido'); } }

// 3.7 database completo (se presente)
let dbSummary = null;
if (dbPath && existsSync(dbPath)) {
  const d = readJson(dbPath);
  if (d.format !== 'sal-builder-db-dump') W('Il file --db non e un sal-builder-db-dump');
  else {
    const c = d.counts ?? {};
    dbSummary = c;
    for (const [bk, tk] of [['decks', 'decks'], ['items', 'items'], ['bars', 'pipeline_bars'], ['snapshots', 'snapshots']])
      if (c[tk] !== undefined && c[tk] !== B[bk].length) W(`Backup JSON e DB completo differiscono su ${tk}: ${B[bk].length} vs ${c[tk]} (normale solo se qualcuno ha modificato dati tra i due download)`);
    const users = d.tables.users ?? [];
    for (const u of users) if (!/^\$2[aby]\$\d\d\$.{53}$/.test(u.password_hash ?? '')) E(`Utente ${u.username}: hash password non valido`);
    const roles = users.map((u) => u.role);
    for (const r of ['MC', 'SC']) if (!roles.includes(r)) E(`Utente ${r} mancante`);
    if (!roles.includes('ADMIN')) W('Utente Admin All non presente (esegui db:migrate con ADMIN_PASSWORD)');
    const week = Date.now() - 7 * 86400000;
    const fails = (d.tables.login_attempts ?? []).filter((a) => !a.ok && new Date(a.at).getTime() > week);
    if (fails.length >= 20) W(`${fails.length} tentativi di login falliti negli ultimi 7 giorni`);
    info.push(`Tentativi di login falliti ultimi 7 giorni: ${fails.length}`);
    info.push(`Audit log: ${(d.tables.audit_log ?? []).length} righe`);
  }
}

// ---------- 4. riepilogo e confronto ----------
const sum = { date: today, decks: decks.length, items: B.items.length, bars: B.bars.length, lookups: B.lookups.length, snapshots: B.snapshots.length, latest: latest?.week_label ?? null, itemIds: {} };
for (const d of decks) sum.itemIds[d.id] = B.items.filter((i) => i.deck_id === d.id).map((i) => i.id);
const by = (f) => cur.reduce((m, i) => ((m[f(i)] = (m[f(i)] ?? 0) + 1), m), {});
info.push(`Settimana corrente: ${sum.latest} · voci attive ${cur.length} (MC ${cur.filter((i) => i.area === 'MC').length}, SC ${cur.filter((i) => i.area === 'SC').length}, AMS ${cur.filter((i) => i.area === 'AMS').length}) · archiviate ${latest ? B.items.filter((i) => i.deck_id === latest.id && i.archived_at).length : 0}`);
info.push('Ticket AMS attivi per stato: ' + JSON.stringify(by((i) => (i.area === 'AMS' ? i.ams_status : null))).replace(/"null":\d+,?/, ''));
info.push(`Totali: ${decks.length} settimane, ${B.items.length} voci, ${B.bars.length} barre, ${B.snapshots.length} snapshot, ${B.lookups.length} valori negli elenchi`);

let prev = null;
if (existsSync(outRoot)) {
  const dirs = readdirSync(outRoot).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n) && n < today && existsSync(join(outRoot, n, 'report.json'))).sort();
  if (dirs.length) prev = { dir: dirs[dirs.length - 1], ...JSON.parse(readFileSync(join(outRoot, dirs[dirs.length - 1], 'report.json'), 'utf8')) };
}
if (prev) {
  info.push(`Confronto con il controllo del ${prev.date}: settimane ${prev.decks}→${sum.decks}, voci ${prev.items}→${sum.items}, barre ${prev.bars}→${sum.bars}`);
  const nowIds = new Set(B.items.map((i) => i.id));
  let lost = 0;
  for (const ids of Object.values(prev.itemIds ?? {})) for (const id of ids) if (!nowIds.has(id)) lost++;
  if (lost) W(`${lost} voci presenti nel controllo del ${prev.date} non ci sono più (eliminate o sostituite da un import in modalità Sostituisci?)`);
  if (sum.items < prev.items) W(`Il numero totale di voci è sceso (${prev.items} → ${sum.items})`);
  if (sum.decks < prev.decks) E(`Il numero di settimane è sceso (${prev.decks} → ${sum.decks})`);
}

const lines = [
  `# Controllo coerenza SAL Builder · ${today}`, '',
  `File: ${backupPath}${dbPath ? ' + ' + dbPath : ''}`, '',
  `**Esito: ${errors.length ? 'ERRORI' : warns.length ? 'OK con avvisi' : 'OK'}** · ${errors.length} errori · ${warns.length} avvisi`, '',
  '## Errori', ...(errors.length ? errors.map((m) => `- ${m}`) : ['- nessuno']), '',
  '## Avvisi', ...(warns.length ? warns.map((m) => `- ${m}`) : ['- nessuno']), '',
  '## Riepilogo', ...info.map((m) => `- ${m}`), '',
];
writeFileSync(join(outDir, 'report.md'), lines.join('\n'));
writeFileSync(join(outDir, 'report.json'), JSON.stringify(sum));
console.log('\n' + lines.join('\n'));
console.log('Report salvato in ' + join(outDir, 'report.md'));
process.exit(errors.length ? 1 : 0);

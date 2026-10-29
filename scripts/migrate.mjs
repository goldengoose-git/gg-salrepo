// Crea le tabelle, i 2 utenti (MC, SC) e il primo deck. Idempotente.
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL mancante (.env.local)'); process.exit(1); }
const sql = neon(url);

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
for (const stmt of schema.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
  await sql.query(stmt);
}
console.log('Schema OK');

// --- Elenchi (Type MC/SC, Owner): popolati dai dati esistenti solo se vuoti ---
function parseOwners(str) {
  const out = [];
  for (const part of String(str ?? '').split(/\s*[\/;]\s*/)) {
    const m = part.match(/^([^:,]+?)\s*:\s*(.*)$/);
    if (m) for (const n of m[2].split(',').map((x) => x.trim()).filter(Boolean)) out.push(`${m[1].trim()}: ${n}`);
    else for (const n of part.split(',').map((x) => x.trim()).filter(Boolean)) out.push(n);
  }
  return [...new Set(out)];
}
async function seed(kind, values) {
  const [{ n }] = await sql.query('select count(*)::int as n from lookups where kind = $1', [kind]);
  if (n > 0) return;
  let pos = 0;
  for (const v of [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))) {
    await sql.query('insert into lookups (kind, value, position) values ($1,$2,$3) on conflict do nothing', [kind, v, ++pos]);
  }
  console.log(`Elenco ${kind}: ${pos} voci`);
}
const rowsT = await sql.query(`select area, type, owner from items`);
const rowsC = await sql.query(`select area, contract from items`);
await seed('type_mc', rowsT.filter((r) => r.area === 'MC').map((r) => (r.type || '').trim()));
await seed('type_sc', rowsT.filter((r) => r.area === 'SC').map((r) => (r.type || '').trim()));
const parseContract = (t) => { const m = String(t ?? '').trim().match(/^(opex|capex)\s*(?:[–—-]\s*(.*))?$/i); return m ? (m[2] ?? '').trim() : String(t ?? '').trim(); };
await seed('contract_label', rowsC.filter((r) => r.area !== 'AMS').map((r) => parseContract(r.contract)).filter((v) => v && v !== '-'));
await seed('owner', rowsT.filter((r) => r.area !== 'AMS').flatMap((r) => parseOwners(r.owner)));

// --- Stima: solo numero (giorni) oppure "-" ---
const norm = (s) => { const m = String(s ?? '').trim().replace(',', '.').match(/^(\d+(?:\.\d+)?)\s*(?:md|gg|d)?$/i); return m ? String(Number(m[1])) : '-'; };
for (const { estimate } of await sql.query('select distinct estimate from items')) {
  const n = norm(estimate);
  if (n !== estimate) await sql.query('update items set estimate = $1 where estimate = $2', [n, estimate]);
}
console.log('Stime normalizzate');

const users = [
  { username: 'mc', role: 'MC', name: 'Utente MC', pwd: process.env.MC_PASSWORD },
  { username: 'sc', role: 'SC', name: 'Utente SC', pwd: process.env.SC_PASSWORD },
];
for (const u of users) {
  if (!u.pwd) { console.warn(`Password ${u.role} non impostata: utente ${u.username} non aggiornato`); continue; }
  const hash = bcrypt.hashSync(u.pwd, 10);
  await sql.query(
    `insert into users (username, role, display_name, password_hash) values ($1,$2,$3,$4)
     on conflict (username) do update set password_hash = excluded.password_hash`,
    [u.username, u.role, u.name, hash]
  );
  console.log(`Utente ${u.username} (${u.role}) OK`);
}

const [{ n }] = await sql.query('select count(*)::int as n from decks');
if (n === 0) {
  const d = new Date();
  await sql.query(
    `insert into decks (week_label, date_label, year) values ($1,$2,$3)`,
    ['Week 1', d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), d.getFullYear()]
  );
  console.log('Primo deck creato');
}
console.log('Fatto.');

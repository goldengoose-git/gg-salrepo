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

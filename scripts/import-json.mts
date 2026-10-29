// Import iniziale da CLI (tutte le aree, senza vincoli di ruolo):
//   npm run db:import -- ./Golden_Goose_SAL_deck_v3.json [--replace]
import { readFileSync } from 'node:fs';
import { q } from '../lib/db.ts';
import { applyImport, parseAny } from '../lib/importer.ts';

const file = process.argv[2];
if (!file) { console.error('Uso: npm run db:import -- file.json [--replace]'); process.exit(1); }
const replace = process.argv.includes('--replace');
const p = parseAny(JSON.parse(readFileSync(file, 'utf8')));
const [deck] = await q<{ id: string }>('select id from decks order by created_at desc limit 1');
if (!deck) { console.error('Nessun deck: esegui prima npm run db:migrate'); process.exit(1); }

// MC importa MC + lane SFMC/CROSS, SC importa SC/AMS + lane SFSC
const a = await applyImport(p, { deckId: deck.id, role: 'MC', scope: 'all', mode: replace ? 'replace' : 'merge', user: 'cli' });
const b = await applyImport(p, { deckId: deck.id, role: 'SC', scope: 'all', mode: replace ? 'replace' : 'merge', user: 'cli' });
const d = p.deck;
await q(`update decks set client=coalesce($1,client), subtitle=coalesce($2,subtitle), date_label=coalesce($3,date_label), year=coalesce($4,year) where id=$5`,
  [d.client ?? null, d.subtitle ?? null, d.date_label ?? null, d.year ?? null, deck.id]);
console.log('Importato:', { MC: a, SC: b });

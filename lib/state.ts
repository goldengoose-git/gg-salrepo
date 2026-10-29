import { q } from './db';
import type { AppState, Bar, Deck, Item, Lookup } from './types';

export async function currentDeck(): Promise<Deck> {
  const rows = await q<Deck>('select * from decks order by created_at desc limit 1');
  if (!rows[0]) throw new Error('Nessun deck: esegui npm run db:migrate');
  return rows[0];
}

export async function getState(): Promise<AppState> {
  const deck = await currentDeck();
  const [items, bars, snapshots, lookups] = await Promise.all([
    q<Item>('select * from items where deck_id = $1 order by area, position, created_at', [deck.id]),
    q<any>('select * from pipeline_bars where deck_id = $1 order by lane, row, start_m', [deck.id]),
    q<any>('select id, week_label, created_by, created_at from snapshots order by created_at desc limit 30'),
    q<Lookup>('select id, kind, value, position from lookups order by kind, position, value').catch(() => [] as Lookup[]),
  ]);
  const num = (x: any) => Number(x);
  return {
    deck,
    items,
    bars: bars.map((b: any): Bar => ({ ...b, start_m: num(b.start_m), end_m: num(b.end_m), row: num(b.row) })),
    snapshots,
    lookups,
  };
}

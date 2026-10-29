import { q } from './db';
import { normEstimate } from './lookups';
import { DONE_RE, LANES, STATUS_KEYS, areasFor, lanesFor, type Area, type BarStatus, type Lane, type Role, type Status } from './constants';

export type ImpItem = Partial<{
  area: Area; code: string; type: string; description: string; priority: string; requested_date: string; golive_date: string;
  owner: string; estimate: string; contract: string; activity: string; status: Status; archived: boolean;
}> & { area: Area };
export type ImpBar = { lane: Lane; label: string; status: BarStatus; start_m: number; end_m: number; row: number };
export type Parsed = { deck: Partial<{ client: string; subtitle: string; date_label: string; year: number }>; items: ImpItem[]; bars: ImpBar[] };

const strip = (s: any) => String(s ?? '').replace(/\*\*/g, '').trim();
const BAR_OK = ['completed', 'wip', 'analysis', 'estimate'];

function ticketStatus(txt: string, fallback: Status): { text: string; status: Status; tag: string } {
  const m = txt.match(/\*{0,2}\(([^)]*)\)\*{0,2}\s*$/);
  let status = fallback;
  let text = txt;
  let tag = '';
  if (m) {
    tag = strip(m[1]);
    const t = m[1].toLowerCase();
    text = txt.slice(0, m.index).trim();
    if (/done|complet|chius|closed/.test(t)) status = 'completed';
    else if (/block/.test(t)) status = 'blocked';
    else if (/delay|ritard/.test(t)) status = 'delay';
    else if (/hold|sospes/.test(t)) status = 'onhold';
    else if (/attesa|wait/.test(t)) status = 'delay';
    else status = 'ontrack';
  }
  return { text, status, tag };
}

// Formato nativo (export JSON di questa app) oppure deck del tool locale "Golden_Goose_SAL_deck"
export function parseAny(j: any): Parsed {
  if (j && j.format === 'sal-builder') {
    return {
      deck: j.deck ?? {},
      items: (j.items ?? []).map((i: any) => ({ ...i, archived: !!i.archived_at || !!i.archived })),
      bars: (j.bars ?? []).map((b: any) => ({ lane: b.lane, label: b.label, status: b.status, start_m: +b.start_m, end_m: +b.end_m, row: +b.row || 0 })),
    };
  }
  if (!j || !Array.isArray(j.slides)) throw new Error('JSON non riconosciuto: manca "slides" o "format".');
  const out: Parsed = { deck: { client: j.client, subtitle: j.sub, date_label: j.date }, items: [], bars: [] };
  for (const s of j.slides) {
    if (s.type === 'pipeline') {
      if (+s.year) out.deck.year = +s.year;
      for (const l of s.lanes ?? []) {
        const lane = String(l.label ?? '').toUpperCase();
        const L: Lane = (LANES as string[]).includes(lane) ? (lane as Lane) : 'CROSS';
        for (const b of l.bars ?? []) {
          out.bars.push({
            lane: L, label: strip(b.label), status: (BAR_OK.includes(b.status) ? b.status : 'wip') as BarStatus,
            start_m: Math.max(0, Math.min(12, +b.start || 0)), end_m: Math.max(0, Math.min(12, +b.end || 1)), row: +b.row || 0,
          });
        }
      }
      continue;
    }
    if (s.type !== 'table' || !Array.isArray(s.rows)) continue;
    const cols: string[] = (s.columns ?? []).map((c: any) => String(c.name ?? ''));
    const ix = (re: RegExp) => cols.findIndex((c) => re.test(c));
    const iType = ix(/^type$/i), iDesc = ix(/descri|subject/i), iPri = ix(/priorit/i), iReq = ix(/request/i),
      iGo = ix(/golive|release/i), iAct = ix(/activity/i), iOwn = ix(/owner/i), iEst = ix(/stima/i), iCon = ix(/contract/i);
    const isCompletedSlide = /^completed/i.test(s.title ?? '') || s.rows.every((r: any) => r.completed);
    const isHold = !!s.hold;
    const area: Area = s.theme === 'sc' ? 'SC' : 'MC';
    const rawAct = (r: any) => (iAct >= 0 ? strip((r.cells ?? [])[iAct]) : '');
    for (const r of s.rows) {
      const c = r.cells ?? [];
      const cell = (i: number) => (i >= 0 ? strip(c[i]) : '');
      const st: Status = STATUS_KEYS.includes(r.status) ? r.status : 'ontrack';
      if (r.kind === 'tickets') {
        for (const it of r.items ?? []) {
          const raw = String(it);
          const m = raw.replace(/\*\*/g, '**').match(/^\s*([A-Za-z]{1,6}-\d+)\s*[-–—:]\s*([\s\S]*)$/);
          const code = m ? m[1] : '';
          const { text, status, tag } = ticketStatus(m ? m[2] : raw, st === 'completed' ? 'ontrack' : st);
          const done = DONE_RE.test(raw) || status === 'completed';
          out.items.push({
            area: 'AMS', code, description: strip(text), status: done ? 'completed' : status, archived: done,
            owner: cell(iOwn), contract: cell(iCon), priority: cell(iPri), activity: tag,
          });
        }
        continue;
      }
      const done = isCompletedSlide || r.completed || st === 'completed';
      out.items.push({
        area, type: cell(iType), description: cell(iDesc), priority: cell(iPri), requested_date: cell(iReq), golive_date: cell(iGo),
        owner: cell(iOwn), estimate: cell(iEst), contract: cell(iCon), activity: rawAct(r),
        status: done ? 'completed' : st, archived: done || isHold,
      });
    }
  }
  return out;
}

export type ImportOpts = { deckId: string; role: Role; scope: 'all' | 'mine' | 'timeline'; mode: 'merge' | 'replace'; user: string; jiraCsv?: boolean };

export async function applyImport(p: Parsed, o: ImportOpts) {
  const areas = areasFor(o.role);
  const lanes = lanesFor(o.role);
  let nItems = 0, nBars = 0;

  if (o.scope !== 'timeline') {
    let items = p.items.filter((i) => areas.includes(i.area));
    if (o.mode === 'merge') {
      const ex = await q<any>('select area, code, description from items where deck_id = $1', [o.deckId]);
      const key = (a: string, c: string, d: string) => o.jiraCsv && a === 'AMS' ? `${a}|${(c ?? '').toUpperCase()}` : `${a}|${c ?? ''}|${d ?? ''}`;
      const have = new Set(ex.map((e: any) => key(e.area, e.code, e.description)));
      items = items.filter((i) => { const k = key(i.area, i.code ?? '', i.description ?? ''); if (have.has(k)) return false; have.add(k); return true; });
    }
    if (o.mode === 'replace') await q('delete from items where deck_id = $1 and area = any($2)', [o.deckId, areas]);
    const base: Record<string, number> = {};
    for (const a of areas) {
      const r = await q<{ m: number }>('select coalesce(max(position),0)::int as m from items where deck_id=$1 and area=$2', [o.deckId, a]);
      base[a] = r[0].m;
    }
    const rows = items.map((i) => ({
      area: i.area, position: ++base[i.area], code: i.code ?? '', type: i.type ?? '', description: i.description ?? '',
      priority: i.priority ?? '', requested_date: i.requested_date ?? '', golive_date: i.golive_date ?? '', owner: i.owner ?? '',
      estimate: normEstimate(i.estimate), contract: i.contract ?? '', activity: i.activity ?? '', status: i.archived ? (i.status ?? 'completed') : (i.status === 'completed' ? 'ontrack' : i.status ?? 'ontrack'),
      archived: !!i.archived || i.status === 'completed',
    }));
    if (rows.length) {
      await q(
        `insert into items (deck_id, area, position, code, type, description, priority, requested_date, golive_date, owner, estimate, contract, activity, status, archived_at, closed_at, updated_by)
         select $1::uuid, x.area, x.position, x.code, x.type, x.description, x.priority, x.requested_date, x.golive_date, x.owner, x.estimate, x.contract, x.activity, x.status,
                case when x.archived then now() end, case when x.archived then now() end, $3
         from jsonb_to_recordset($2::jsonb) as x(area text, position int, code text, type text, description text, priority text, requested_date text, golive_date text, owner text, estimate text, contract text, activity text, status text, archived boolean)`,
        [o.deckId, JSON.stringify(rows), o.user]
      );
    }
    nItems = rows.length;
  }

  if (o.scope !== 'mine') {
    let bars = p.bars.filter((b) => lanes.includes(b.lane));
    if (o.mode === 'merge') {
      // in unione salta le barre già presenti (stessa lane, nome e periodo): evita i duplicati se reimporti
      const ex = await q<any>('select lane, label, start_m, end_m from pipeline_bars where deck_id = $1', [o.deckId]);
      const key = (l: string, t: string, a: any, b: any) => `${l}|${t}|${Number(a)}|${Number(b)}`;
      const have = new Set(ex.map((e: any) => key(e.lane, e.label, e.start_m, e.end_m)));
      bars = bars.filter((b) => !have.has(key(b.lane, b.label, b.start_m, b.end_m)));
    }
    if (o.mode === 'replace') await q('delete from pipeline_bars where deck_id = $1 and lane = any($2)', [o.deckId, lanes]);
    if (bars.length) {
      await q(
        `insert into pipeline_bars (deck_id, lane, label, status, start_m, end_m, row, updated_by)
         select $1::uuid, x.lane, x.label, x.status, x.start_m, x.end_m, x.row, $3
         from jsonb_to_recordset($2::jsonb) as x(lane text, label text, status text, start_m numeric, end_m numeric, row int)`,
        [o.deckId, JSON.stringify(bars), o.user]
      );
    }
    nBars = bars.length;
  }
  return { items: nItems, bars: nBars };
}

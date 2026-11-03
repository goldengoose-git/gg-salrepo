import { q } from './db';
import { normEstimate } from './lookups';
import { AMS_KEYS, AMS_STATUS, DONE_RE, LANES, STATUS_KEYS, areasFor, jiraStatus, lanesFor, type AmsStatus, type Area, type BarStatus, type Lane, type Role, type Status } from './constants';

export type ImpItem = Partial<{
  area: Area; code: string; type: string; description: string; priority: string; requested_date: string; golive_date: string;
  owner: string; estimate: string; contract: string; activity: string; status: Status; archived: boolean;
  release_date: string; ams_status: AmsStatus; closed_at: string;
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
            ams_status: done ? 'done' : (jiraStatus(tag) ?? (status === 'ontrack' ? 'wip' : 'waiting')),
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

export type ImportOpts = { deckId: string; role: Role; scope: 'all' | 'mine' | 'timeline'; mode: 'merge' | 'replace'; user: string; skipNewDone?: boolean };

export async function applyImport(p: Parsed, o: ImportOpts) {
  const areas = areasFor(o.role);
  const lanes = lanesFor(o.role);
  let nItems = 0, nBars = 0, nUpdated = 0;

  if (o.scope !== 'timeline') {
    let items = p.items.filter((i) => areas.includes(i.area));
    // ticket AMS: lo stato Jira decide archivio e colore; un ticket Done va in archivio
    items = items.map((i) => {
      if (i.area !== 'AMS') return i;
      const am: AmsStatus = i.ams_status && AMS_KEYS.includes(i.ams_status) ? i.ams_status : (i.archived || i.status === 'completed' ? 'done' : 'wip');
      return { ...i, ams_status: am, status: AMS_STATUS[am].status, archived: !!i.archived };
    });
    const toRow = (i: ImpItem, position: number) => ({
      area: i.area, position, code: i.code ?? '', type: i.type ?? '', description: i.description ?? '',
      priority: i.priority ?? '', requested_date: i.requested_date ?? '', golive_date: i.golive_date ?? '', release_date: i.release_date ?? '', owner: i.owner ?? '',
      estimate: normEstimate(i.estimate), contract: i.contract ?? '', activity: i.activity ?? '', ams_status: i.area === 'AMS' ? (i.ams_status ?? null) : null,
      status: i.status ?? (i.archived ? 'completed' : 'ontrack'),
      archived: !!i.archived, closed_at: i.closed_at || null,
    });
    if (o.mode === 'merge') {
      const ex = await q<any>('select id, area, code, description from items where deck_id = $1', [o.deckId]);
      const key = (a: string, c: string, d: string) => `${a}|${c ?? ''}|${d ?? ''}`;
      const have = new Set(ex.map((e: any) => key(e.area, e.code, e.description)));
      // ticket AMS già presenti (stesso codice): si aggiornano stato, titolo, priorità, owner e data, invece di duplicarli
      const byCode = new Map<string, string>(ex.filter((e: any) => e.area === 'AMS' && e.code).map((e: any) => [e.code, e.id]));
      const upd = items.filter((i) => i.area === 'AMS' && i.code && byCode.has(i.code));
      if (upd.length) {
        const rows = upd.map((i) => ({ ...toRow(i, 0), id: byCode.get(i.code!) }));
        await q(
          `update items t set description = x.description, priority = x.priority, owner = x.owner,
                  requested_date = case when x.requested_date <> '' then x.requested_date else t.requested_date end,
                  ams_status = x.ams_status, status = x.status,
                  archived_at = case when x.ams_status = 'done' then t.archived_at end,
                  closed_at = case when x.ams_status = 'done' then coalesce(t.closed_at, x.closed_at::timestamptz, now()) end,
                  updated_by = $2, updated_at = now()
           from jsonb_to_recordset($1::jsonb) as x(id uuid, description text, priority text, owner text, requested_date text, ams_status text, status text, archived boolean, closed_at text)
           where t.id = x.id`,
          [JSON.stringify(rows), o.user]
        );
        nUpdated = upd.length;
      }
      const updSet = new Set(upd);
      items = items.filter((i) => !updSet.has(i) && !have.has(key(i.area, i.code ?? '', i.description ?? '')));
    }
    if (o.skipNewDone) items = items.filter((i) => !(i.area === 'AMS' && i.ams_status === 'done'));
    if (o.mode === 'replace') await q('delete from items where deck_id = $1 and area = any($2)', [o.deckId, areas]);
    const base: Record<string, number> = {};
    for (const a of areas) {
      const r = await q<{ m: number }>('select coalesce(max(position),0)::int as m from items where deck_id=$1 and area=$2', [o.deckId, a]);
      base[a] = r[0].m;
    }
    const rows = items.map((i) => toRow(i, ++base[i.area]));
    if (rows.length) {
      await q(
        `insert into items (deck_id, area, position, code, type, description, priority, requested_date, golive_date, release_date, owner, estimate, contract, activity, status, ams_status, archived_at, closed_at, updated_by)
         select $1::uuid, x.area, x.position, x.code, x.type, x.description, x.priority, x.requested_date, x.golive_date, x.release_date, x.owner, x.estimate, x.contract, x.activity, x.status, x.ams_status,
                case when x.archived then coalesce(x.closed_at::timestamptz, now()) end, case when x.archived then coalesce(x.closed_at::timestamptz, now()) end, $3
         from jsonb_to_recordset($2::jsonb) as x(area text, position int, code text, type text, description text, priority text, requested_date text, golive_date text, release_date text, owner text, estimate text, contract text, activity text, status text, ams_status text, archived boolean, closed_at text)`,
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
  return { items: nItems, bars: nBars, updated: nUpdated };
}

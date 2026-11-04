import ExcelJS from 'exceljs';
import { q } from '@/lib/db';
import { AMS_STATUS, STATUS } from '@/lib/constants';
import { audit, isErr, needAdmin } from '@/lib/http';
import { fmtEstimate } from '@/lib/lookups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const iso = (v: any) => (v ? new Date(v).toISOString().slice(0, 16).replace('T', ' ') : '');

// Export Excel Admin All: tutte le settimane (voci attive e archiviate, timeline, elenchi, impostazioni).
export async function GET() {
  const me = await needAdmin();
  if (isErr(me)) return me;
  const [decks, items, bars, lookups, settings] = await Promise.all([
    q<any>('select * from decks order by created_at'),
    q<any>('select i.*, d.week_label from items i join decks d on d.id = i.deck_id order by d.created_at, i.area, i.position'),
    q<any>('select b.*, d.week_label from pipeline_bars b join decks d on d.id = b.deck_id order by d.created_at, b.lane, b.row, b.start_m'),
    q<any>('select kind, value, position from lookups order by kind, position').catch(() => []),
    q<any>('select key, value from settings order by key').catch(() => []),
  ]);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SAL Builder';
  const sheet = (name: string, cols: { h: string; k: string; w: number }[], rows: any[]) => {
    const ws = wb.addWorksheet(name);
    ws.columns = cols.map((c) => ({ header: c.h, key: c.k, width: c.w }));
    rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C2D2C' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    return ws;
  };
  const itemCols = [
    { h: 'Week', k: 'week', w: 10 }, { h: 'Codice', k: 'code', w: 12 }, { h: 'Type', k: 'type', w: 14 }, { h: 'Descrizione', k: 'd', w: 60 }, { h: 'Priorità', k: 'p', w: 10 },
    { h: 'Requested', k: 'r', w: 14 }, { h: 'GoLive', k: 'g', w: 14 }, { h: 'Release', k: 'rel', w: 14 }, { h: 'Owner', k: 'o', w: 22 }, { h: 'Stima', k: 'e', w: 8 },
    { h: 'Contract', k: 'k', w: 26 }, { h: 'Activity', k: 'a', w: 22 }, { h: 'Status', k: 's', w: 20 }, { h: 'Archiviato il', k: 'ar', w: 17 }, { h: 'Chiuso il', k: 'cl', w: 17 },
    { h: 'Aggiornato da', k: 'ub', w: 14 }, { h: 'Aggiornato il', k: 'ua', w: 17 },
  ];
  const row = (i: any) => ({
    week: i.week_label, code: i.code, type: i.type, d: i.description, p: i.priority, r: i.requested_date, g: i.golive_date, rel: i.release_date, o: i.owner,
    e: fmtEstimate(i.estimate), k: i.contract, a: i.activity, s: i.area === 'AMS' && i.ams_status ? AMS_STATUS[i.ams_status as keyof typeof AMS_STATUS]?.label : STATUS[i.status as keyof typeof STATUS]?.label,
    ar: iso(i.archived_at), cl: iso(i.closed_at), ub: i.updated_by ?? '', ua: iso(i.updated_at),
  });
  sheet('Azioni MC', itemCols, items.filter((i: any) => i.area === 'MC').map(row));
  sheet('Azioni SC', itemCols, items.filter((i: any) => i.area === 'SC').map(row));
  sheet('Ticket AMS', itemCols, items.filter((i: any) => i.area === 'AMS').map(row));
  sheet('Archivio', itemCols, items.filter((i: any) => i.archived_at).map(row));
  sheet('Timeline', [
    { h: 'Week', k: 'w', w: 10 }, { h: 'Lane', k: 'l', w: 8 }, { h: 'Attività', k: 'a', w: 50 }, { h: 'Stato', k: 's', w: 12 }, { h: 'Inizio (mese)', k: 'st', w: 12 }, { h: 'Fine (mese)', k: 'en', w: 12 }, { h: 'Riga', k: 'r', w: 6 },
  ], bars.map((b: any) => ({ w: b.week_label, l: b.lane, a: b.label, s: b.status, st: Number(b.start_m), en: Number(b.end_m), r: b.row })));
  sheet('Settimane', [
    { h: 'Week', k: 'w', w: 10 }, { h: 'Data SAL', k: 'd', w: 14 }, { h: 'Cliente', k: 'c', w: 18 }, { h: 'Stato', k: 's', w: 10 }, { h: 'Creata il', k: 'cr', w: 17 }, { h: 'Id', k: 'id', w: 38 },
  ], decks.map((d: any) => ({ w: d.week_label, d: d.sal_date ?? '', c: d.client, s: d.status, cr: iso(d.created_at), id: d.id })));
  sheet('Elenchi', [{ h: 'Elenco', k: 'k', w: 18 }, { h: 'Valore', k: 'v', w: 40 }, { h: 'Posizione', k: 'p', w: 10 }], lookups.map((l: any) => ({ k: l.kind, v: l.value, p: l.position })));
  sheet('Impostazioni', [{ h: 'Chiave', k: 'k', w: 24 }, { h: 'Valore', k: 'v', w: 80 }], settings.map((s: any) => ({ k: s.key, v: s.value })));
  await audit(me, 'export-xlsx', 'db', null, { items: items.length, decks: decks.length });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="SAL_export_completo_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      'cache-control': 'no-store',
    },
  });
}

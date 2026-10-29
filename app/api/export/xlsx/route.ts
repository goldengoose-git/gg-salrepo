import { fmtEstimate } from '@/lib/lookups';
import ExcelJS from 'exceljs';
import { STATUS } from '@/lib/constants';
import { isErr, needUser } from '@/lib/http';
import { getState } from '@/lib/state';

export const runtime = 'nodejs';

export async function GET() {
  const me = await needUser();
  if (isErr(me)) return me;
  const st = await getState();
  const wb = new ExcelJS.Workbook();
  const head = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C2D2C' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };
  const done = wb.addWorksheet('Completed Activities');
  done.columns = [
    { header: 'Area', key: 'a', width: 8 }, { header: 'Ticket', key: 'c', width: 12 }, { header: 'Type', key: 't', width: 14 },
    { header: 'Description', key: 'd', width: 60 }, { header: 'Priorità', key: 'p', width: 10 }, { header: 'GoLive Date', key: 'g', width: 12 },
    { header: 'Owner', key: 'o', width: 16 }, { header: 'Stima', key: 'e', width: 8 }, { header: 'Contract Type & Status', key: 'k', width: 26 },
    { header: 'Chiuso il', key: 'x', width: 14 },
  ];
  for (const i of st.items.filter((x) => x.archived_at))
    done.addRow({ a: i.area, c: i.code, t: i.type, d: i.description, p: i.priority, g: i.golive_date, o: i.owner, e: fmtEstimate(i.estimate), k: i.contract, x: (i.closed_at ?? i.archived_at ?? '').toString().slice(0, 10) });
  head(done);
  const ams = wb.addWorksheet('Ticket AMS');
  ams.columns = [
    { header: 'Ticket', key: 'c', width: 12 }, { header: 'Subject', key: 'd', width: 70 }, { header: 'Priorità', key: 'p', width: 10 },
    { header: 'Owner', key: 'o', width: 16 }, { header: 'Opened', key: 'r', width: 12 }, { header: 'Status', key: 's', width: 14 },
    { header: 'Archiviato', key: 'a', width: 11 },
  ];
  for (const i of st.items.filter((x) => x.area === 'AMS'))
    ams.addRow({ c: i.code, d: i.description, p: i.priority, o: i.owner, r: i.requested_date, s: STATUS[i.status].label, a: i.archived_at ? 'sì' : '' });
  head(ams);
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="SAL_${st.deck.week_label.replace(/\W+/g, '_')}_archivio_ticket.xlsx"`,
    },
  });
}

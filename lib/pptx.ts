import PptxGenJS from 'pptxgenjs';
import { BAR_STATUS, STATUS } from './constants';
import { buildSlides } from './slides';
import type { AppState } from './types';

const PX = 13.333 / 1280; // 1 px slide -> pollici
const px = (n: number) => n * PX;
const clean = (s: string) => String(s ?? '').replace(/\*\*/g, '');
const hex = (c: string) => c.replace('#', '');
const FONT_T = 'Montserrat';
const FONT_B = 'Outfit';

async function img(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const type = (r.headers.get('content-type') || 'image/png').split(';')[0];
    const buf = Buffer.from(await r.arrayBuffer());
    return `${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function buildPptx(st: AppState, includeArchive: boolean): Promise<Buffer> {
  const d = st.deck;
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
  pres.title = `${d.client} – ${d.subtitle} – ${d.week_label}`;
  pres.author = 'SAL Builder';

  const [logoL, logoR, bgCover, bgDiv, bgTab] = await Promise.all([
    img(d.logo_left_url), img(d.logo_right_url), img(d.bg_cover_url), img(d.bg_divider_url), img(d.bg_table_url),
  ]);
  const slides = buildSlides(st, includeArchive);

  const dark = (s: PptxGenJS.Slide, bg: string | null) => {
    s.background = { color: '15171B' };
    if (bg) {
      s.addImage({ data: bg, x: 0, y: 0, w: 13.333, h: 7.5 });
      if (d.overlay > 0) s.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: '000000', transparency: 100 - d.overlay }, line: { type: 'none' } });
    }
    s.addShape('rect', { x: 0, y: 0, w: px(14), h: 7.5, fill: { color: 'E0301E' }, line: { type: 'none' } });
  };

  for (const sl of slides) {
    const s = pres.addSlide();
    if (sl.kind === 'cover') {
      dark(s, bgCover);
      if (logoL) s.addImage({ data: logoL, x: 0.6, y: 0.5, w: 2.2, h: 0.9, sizing: { type: 'contain', w: 2.2, h: 0.9 } });
      if (logoR) s.addImage({ data: logoR, x: 10.5, y: 0.5, w: 2.2, h: 0.9, sizing: { type: 'contain', w: 2.2, h: 0.9 } });
      s.addText(d.client.toUpperCase(), { x: 0.8, y: 3.0, w: 11, h: 0.5, fontFace: FONT_T, fontSize: 16, bold: true, color: 'F6B3AA', charSpacing: 4 });
      s.addText('Weekly SAL', { x: 0.8, y: 3.45, w: 11, h: 1.0, fontFace: FONT_T, fontSize: 44, bold: true, color: 'FFFFFF' });
      s.addText(`${d.subtitle} · ${d.date_label}`, { x: 0.8, y: 4.5, w: 11, h: 0.5, fontFace: FONT_B, fontSize: 18, color: 'D6D8DE' });
    } else if (sl.kind === 'section' || sl.kind === 'closing') {
      dark(s, bgDiv);
      s.addText(sl.kind === 'section' ? sl.title : 'Grazie', { x: 0.8, y: 3.0, w: 11.5, h: 1.2, fontFace: FONT_T, fontSize: 40, bold: true, color: 'FFFFFF' });
      if (logoL && sl.kind === 'closing') s.addImage({ data: logoL, x: 0.8, y: 5.6, w: 2.0, h: 0.8, sizing: { type: 'contain', w: 2.0, h: 0.8 } });
    } else if (sl.kind === 'table') {
      s.background = { color: 'FFFFFF' };
      if (bgTab) s.addImage({ data: bgTab, x: 0, y: 0, w: 13.333, h: 7.5 });
      s.addShape('rect', { x: 0, y: 0, w: px(14), h: 7.5, fill: { color: sl.theme === 'completed' ? '7135A8' : 'E0301E' }, line: { type: 'none' } });
      s.addText(clean(sl.title) + (sl.part ? `  (${sl.part})` : ''), { x: 0.5, y: 0.25, w: 9, h: 0.5, fontFace: FONT_T, fontSize: 20, bold: true, color: '2C2D2C' });
      if (logoR) s.addImage({ data: logoR, x: 11.4, y: 0.2, w: 1.5, h: 0.6, sizing: { type: 'contain', w: 1.5, h: 0.6 } });
      if (sl.legend) {
        let lx = 0.5;
        for (const k of ['ontrack', 'delay', 'blocked', 'onhold'] as const) {
          s.addShape('ellipse', { x: lx, y: 0.88, w: 0.13, h: 0.13, fill: { color: hex(STATUS[k].color) }, line: { type: 'none' } });
          s.addText(STATUS[k].label, { x: lx + 0.18, y: 0.82, w: 1.0, h: 0.25, fontFace: FONT_B, fontSize: 9, color: '555555' });
          lx += 1.25;
        }
      }
      const tot = sl.columns.reduce((a, c) => a + c.w, 0);
      const W = 12.3;
      const colW = sl.columns.map((c) => (c.w / tot) * W);
      const border = { type: 'solid' as const, pt: 0.5, color: 'DDDDDD' };
      const header = sl.columns.map((c) => ({
        text: c.name,
        options: { bold: true, color: 'FFFFFF', fill: { color: sl.theme === 'completed' ? '7135A8' : '2C2D2C' }, fontFace: FONT_T, fontSize: 8, align: c.align === 'c' ? 'center' : 'left', valign: 'middle', border },
      }));
      const body = sl.rows.map((r) =>
        r.cells.map((t, ci) => {
          const isSt = ci === sl.statusCol && r.status;
          const col = sl.columns[ci];
          return {
            text: clean(t),
            options: {
              fontFace: FONT_B, fontSize: 8.5, valign: 'middle', align: col.align === 'c' ? 'center' : 'left', border,
              color: isSt ? STATUS[r.status!].text.replace('#', '') : '2C2D2C', bold: !!isSt,
              ...(isSt ? { fill: { color: hex(STATUS[r.status!].color) } } : {}),
            },
          };
        })
      );
      s.addTable([header, ...body] as any, { x: 0.5, y: 1.2, w: W, colW, rowH: 0.4, margin: [0.03, 0.06, 0.03, 0.06] });
    } else if (sl.kind === 'pipeline') {
      s.background = { color: 'FFFFFF' };
      s.addShape('rect', { x: 0, y: 0, w: px(14), h: 7.5, fill: { color: 'E0301E' }, line: { type: 'none' } });
      s.addText(`${sl.title} ${sl.year}`, { x: 0.5, y: 0.25, w: 9, h: 0.5, fontFace: FONT_T, fontSize: 20, bold: true, color: '2C2D2C' });
      const TLX = 1.5, TLW = 11.4, mw = TLW / 12;
      const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      months.forEach((m, i) => s.addText(m, { x: TLX + i * mw, y: 0.95, w: mw, h: 0.25, fontFace: FONT_T, fontSize: 8, bold: true, color: '777777', align: 'center' }));
      for (let i = 0; i <= 12; i++) s.addShape('line', { x: TLX + i * mw, y: 1.25, w: 0, h: 5.9, line: { color: i % 3 === 0 ? 'BBBBBB' : 'E6E6E6', width: 0.5 } });
      const rowsPer = sl.lanes.map((l) => Math.max(1, ...l.bars.map((b) => b.row + 1)));
      const total = rowsPer.reduce((a, b) => a + b, 0);
      const pitch = Math.min(0.32, (5.9 - sl.lanes.length * 0.12) / Math.max(1, total));
      let y = 1.3;
      sl.lanes.forEach((l, li) => {
        s.addText(l.label, { x: 0.5, y, w: 0.95, h: pitch, fontFace: FONT_T, fontSize: 9, bold: true, color: '2C2D2C' });
        for (const b of l.bars) {
          const bs = BAR_STATUS[b.status];
          s.addText(clean(b.label), {
            x: TLX + (b.start / 12) * TLW, y: y + b.row * pitch, w: Math.max(0.1, ((b.end - b.start) / 12) * TLW), h: pitch - 0.04,
            shape: 'rect' as any, fill: { color: hex(bs.color) }, color: hex(bs.text), fontFace: FONT_B, fontSize: 7, margin: [0, 4, 0, 4], valign: 'middle', fit: 'shrink',
          } as any);
        }
        y += rowsPer[li] * pitch + 0.12;
        s.addShape('line', { x: 0.5, y: y - 0.06, w: 12.4, h: 0, line: { color: 'DDDDDD', width: 0.5 } });
      });
      s.addShape('line', { x: TLX + (sl.today / 12) * TLW, y: 1.2, w: 0, h: 5.95, line: { color: 'E0301E', width: 1.5 } });
    }
  }
  const out = await pres.write({ outputType: 'nodebuffer' });
  return out as Buffer;
}

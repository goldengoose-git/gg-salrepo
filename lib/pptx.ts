import PptxGenJS from 'pptxgenjs';
import { BAR_STATUS, STATUS } from './constants';
import { PRIO, prioKey } from './prio';
import { buildSlides, PIPE, pipePitch } from './slides';
import type { AppState } from './types';

const PX = 13.333 / 1280; // 1 px slide -> pollici
const px = (n: number) => n * PX;
const clean = (s: string) => String(s ?? '').replace(/\*\*/g, '');
const hex = (c: string) => c.replace('#', '');
const FONT_T = 'Montserrat';
const FONT_B = 'Outfit';

// AddImage expects a complete data URI, not a bare "image/png;base64,..." string.
// Preserve the natural aspect ratio of logos (PPTX's `sizing` option is not
// supported by PptxGenJS 3.x and previously stretched them to the box).
type ImageData = { data: string; ratio: number };
function imageRatio(buf: Buffer, type: string): number {
  if (type === 'image/svg+xml') {
    const xml = buf.toString('utf8');
    const svg = xml.match(/<svg\b[^>]*>/i)?.[0] || '';
    const vb = svg.match(/\bviewBox\s*=\s*["']\s*([\d.eE+-]+)[,\s]+([\d.eE+-]+)[,\s]+([\d.eE+-]+)[,\s]+([\d.eE+-]+)["']/i);
    if (vb && +vb[3] > 0 && +vb[4] > 0) return +vb[3] / +vb[4];
    const w = svg.match(/\bwidth\s*=\s*["']\s*([\d.]+)/i);
    const h = svg.match(/\bheight\s*=\s*["']\s*([\d.]+)/i);
    if (w && h && +h[1] > 0) return +w[1] / +h[1];
  }
  if (type === 'image/png' && buf.length >= 24 && buf.subarray(1, 4).toString() === 'PNG')
    return buf.readUInt32BE(16) / buf.readUInt32BE(20);
  if (type === 'image/jpeg' && buf.length > 4) {
    let i = 2;
    while (i + 4 < buf.length) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      if (marker === 0xff) { i++; continue; }
      if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
      const size = buf.readUInt16BE(i + 2);
      if (size < 2 || i + 2 + size > buf.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && size >= 7)
        return buf.readUInt16BE(i + 7) / buf.readUInt16BE(i + 5);
      i += 2 + size;
    }
  }
  if (type === 'image/webp' && buf.length >= 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return (1 + buf.readUIntLE(24, 3)) / (1 + buf.readUIntLE(27, 3));
    if (chunk === 'VP8 ' && buf.length >= 30) return (buf.readUInt16LE(26) & 0x3fff) / (buf.readUInt16LE(28) & 0x3fff);
    if (chunk === 'VP8L' && buf.length >= 25) {
      const bits = buf.readUInt32LE(21);
      return (1 + (bits & 0x3fff)) / (1 + ((bits >>> 14) & 0x3fff));
    }
  }
  return 1; // safe fallback for unrecognised metadata
}
function contain(image: ImageData, x: number, y: number, w: number, h: number) {
  const ratio = image.ratio;
  const iw = ratio > 0 && Number.isFinite(ratio) ? Math.min(w, h * ratio) : Math.min(w, h);
  const ih = ratio > 0 && Number.isFinite(ratio) ? iw / ratio : Math.min(w, h);
  return { data: image.data, x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih };
}
async function img(url: string | null): Promise<ImageData | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const type = (r.headers.get('content-type') || 'image/png').split(';')[0].trim().toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'].includes(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return { data: `data:${type};base64,${buf.toString('base64')}`, ratio: imageRatio(buf, type) };
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

  const dark = (s: PptxGenJS.Slide, bg: ImageData | null) => {
    s.background = { color: '15171B' };
    if (bg) {
      s.addImage({ data: bg.data, x: 0, y: 0, w: 13.333, h: 7.5 });
      if (d.overlay > 0) s.addShape('rect', { x: 0, y: 0, w: 13.333, h: 7.5, fill: { color: '000000', transparency: 100 - d.overlay }, line: { type: 'none' } });
    }
    s.addShape('rect', { x: 0, y: 0, w: px(14), h: 7.5, fill: { color: 'E0301E' }, line: { type: 'none' } });
  };

  let pageNo = 0;
  const footer = (s: PptxGenJS.Slide, _sl: unknown) => {
    s.addShape('line', { x: px(46), y: 7.5 - px(34), w: px(1200), h: 0, line: { color: '111111', width: 1.5 } });
    s.addText(`${d.subtitle} · ${d.date_label}`, { x: px(46), y: 7.5 - px(32), w: 8, h: px(30), fontFace: FONT_B, fontSize: 10, bold: true, color: '777777', margin: 0, valign: 'middle' });
    s.addText(String(pageNo), { x: px(1246) - 1, y: 7.5 - px(32), w: 1, h: px(30), fontFace: FONT_B, fontSize: 10, bold: true, color: '777777', margin: 0, valign: 'middle', align: 'right' });
  };
  for (const sl of slides) {
    const s = pres.addSlide();
    pageNo++;
    if (sl.kind === 'cover') {
      dark(s, bgCover);
      if (logoL) s.addImage(contain(logoL, 0.6, 0.5, 2.2, 0.9));
      if (logoR) s.addImage(contain(logoR, 10.5, 0.5, 2.2, 0.9));
      s.addText(d.client.toUpperCase(), { x: 0.8, y: 3.0, w: 11, h: 0.5, fontFace: FONT_T, fontSize: 16, bold: true, color: 'F6B3AA', charSpacing: 4 });
      s.addText('Weekly SAL', { x: 0.8, y: 3.45, w: 11, h: 1.0, fontFace: FONT_T, fontSize: 44, bold: true, color: 'FFFFFF' });
      s.addText(`${d.subtitle} · ${d.date_label}`, { x: 0.8, y: 4.5, w: 11, h: 0.5, fontFace: FONT_B, fontSize: 18, color: 'D6D8DE' });
    } else if (sl.kind === 'section' || sl.kind === 'closing') {
      dark(s, bgDiv);
      s.addText(sl.kind === 'section' ? sl.title : 'Thank you', { x: 0.8, y: 3.0, w: 11.5, h: 1.2, fontFace: FONT_T, fontSize: 40, bold: true, color: 'FFFFFF' });
      if (logoL && sl.kind === 'closing') s.addImage(contain(logoL, 0.8, 5.6, 2.0, 0.8));
    } else if (sl.kind === 'table') {
      s.background = { color: 'FFFFFF' };
      if (bgTab) s.addImage({ data: bgTab.data, x: 0, y: 0, w: 13.333, h: 7.5 });
      s.addShape('rect', { x: 0, y: 0, w: px(14), h: 7.5, fill: { color: sl.theme === 'completed' ? '7135A8' : 'E0301E' }, line: { type: 'none' } });
      s.addText(clean(sl.title) + (sl.part ? `  (${sl.part})` : ''), { x: 0.5, y: 0.2, w: 9, h: 0.5, fontFace: FONT_T, fontSize: 20, bold: true, color: '2C2D2C' });
      if (logoR) s.addImage(contain(logoR, 11.4, 0.2, 1.5, 0.6));
      if (sl.legend) {
        let lx = 0.5;
        for (const k of ['ontrack', 'delay', 'blocked', 'onhold'] as const) {
          s.addShape('ellipse', { x: lx, y: 0.78, w: 0.12, h: 0.12, fill: { color: hex(STATUS[k].color) }, line: { type: 'none' } });
          s.addText(STATUS[k].label, { x: lx + 0.17, y: 0.72, w: 1.0, h: 0.25, fontFace: FONT_B, fontSize: 9, color: '555555' });
          lx += 1.25;
        }
      }
      const tot = sl.columns.reduce((a, c) => a + c.w, 0);
      const W = px(1190);
      const colW = sl.columns.map((c) => (c.w / tot) * W);
      const white = { type: 'solid' as const, pt: 1.5, color: 'FFFFFF' };
      const accent = sl.theme === 'completed' ? '7135A8' : 'E0301E';
      const header = sl.columns.map((c) => ({
        text: c.name,
        options: { bold: true, color: '2C2D2C', fill: { color: 'F1F1F1' }, fontFace: FONT_T, fontSize: 8.5, align: c.align === 'c' ? 'center' : 'left', valign: 'middle',
          border: [white, white, { type: 'solid' as const, pt: 2.25, color: accent }, white] },
      }));
      // testo con "(next step: …)" in grassetto, **x** in grassetto
      const runs = (t: string, size: number) => {
        const out: any[] = [];
        const re = /\*\*(.+?)\*\*|\(\s*next\s*step[^)]*\)/gi;
        let last = 0, m: RegExpExecArray | null;
        const lines = (x: string, bold: boolean) => x.split('\n').forEach((ln, i, arr) => { if (ln || arr.length === 1) out.push({ text: ln, options: { bold, fontSize: size, breakLine: i < arr.length - 1 } }); else out.push({ text: '', options: { fontSize: size, breakLine: true } }); });
        while ((m = re.exec(t))) { if (m.index > last) lines(t.slice(last, m.index), false); lines(m[1] ?? m[0], true); last = m.index + m[0].length; }
        if (last < t.length) lines(t.slice(last), false);
        return out.length ? out : [{ text: '', options: { fontSize: size } }];
      };
      const body = sl.rows.map((r, ri) =>
        r.cells.map((t, ci) => {
          const col = sl.columns[ci];
          const zebra = ri % 2 === 1 ? 'F4F4F4' : 'FFFFFF';
          const base: any = { fontFace: FONT_B, fontSize: 8.5, valign: 'middle', align: col.align === 'c' ? 'center' : 'left', border: white, color: '2C2D2C', fill: { color: zebra } };
          if (ci === 0 && r.status) {
            const st = STATUS[r.status];
            return { text: clean(t), options: { ...base, fontFace: FONT_T, bold: true, fontSize: 10, align: 'center', color: hex(st.ink), fill: { color: hex(st.tint) },
              border: [white, white, white, { type: 'solid' as const, pt: 5, color: hex(st.stripe) }], valign: r.ams ? 'top' : 'middle' } };
          }
          if (r.ams && ci === 1) {
            const rr: any[] = [{ text: clean(t), options: { bold: true, fontSize: 10, breakLine: true } }, { text: ' ', options: { fontSize: 4, breakLine: true } }];
            r.ams.forEach((a, k) => {
              rr.push({ text: `${a.t} `, options: { bullet: { indent: 12 }, fontSize: 8.5 } });
              rr.push({ text: `(${a.tag})`, options: { bold: true, fontSize: 8.5, breakLine: k < r.ams!.length - 1 } });
            });
            return { text: rr, options: { ...base, align: 'left', valign: 'top' } };
          }
          if (ci === sl.prioCol && t) {
            const k = prioKey(t);
            if (k) return { text: [{ text: PRIO[k].glyph + ' ', options: { color: hex(PRIO[k].c), bold: true, fontSize: 11 } }, { text: t, options: { color: '2C2D2C' } }], options: base };
          }
          if (ci === sl.statusCol) return { text: clean(t), options: { ...base, align: 'center' } };
          return { text: runs(t, 8.5), options: base };
        })
      );
      s.addTable([header, ...body] as any, { x: px(46), y: px(100), w: W, colW, rowH: sl.theme === 'ams' ? undefined : px(44), margin: [0.03, 0.08, 0.03, 0.08] });
      footer(s, sl);
    } else if (sl.kind === 'pipeline') {
      s.background = { color: 'FFFFFF' };
      s.addShape('rect', { x: 0, y: 0, w: px(14), h: 7.5, fill: { color: 'E0301E' }, line: { type: 'none' } });
      s.addText(`${sl.title} ${sl.year}` + (sl.part ? `  (${sl.part})` : ''), { x: 0.5, y: 0.2, w: 7.5, h: 0.5, fontFace: FONT_T, fontSize: 20, bold: true, color: '2C2D2C' });
      let gx = 8.4;
      (Object.keys(BAR_STATUS) as (keyof typeof BAR_STATUS)[]).forEach((k) => {
        s.addShape('ellipse', { x: gx, y: 0.38, w: 0.12, h: 0.12, fill: { color: hex(BAR_STATUS[k].color) }, line: { type: 'none' } });
        s.addText(BAR_STATUS[k].label, { x: gx + 0.17, y: 0.32, w: 0.95, h: 0.25, wrap: false, fontFace: FONT_B, fontSize: 9, color: '555555' });
        gx += 1.15;
      });
      const TLX = px(78), TLW = px(1170), mw = TLW / 12;
      const top = px(PIPE.top), bottom = px(PIPE.bottom);
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      for (let q = 0; q < 4; q++) s.addText(`${sl.year} - Q${q + 1}`, { x: TLX + q * 3 * mw, y: px(62), w: 3 * mw, h: 0.24, fontFace: FONT_T, fontSize: 10, bold: true, color: '222222', align: 'center', valign: 'middle', margin: 0 });
      months.forEach((m, i) => s.addText(m, { x: TLX + i * mw, y: px(90), w: mw, h: 0.2, fontFace: FONT_B, fontSize: 8, color: '777777', align: 'center', valign: 'middle', margin: 0 }));
      for (let i = 0; i <= 12; i++) s.addShape('line', { x: TLX + i * mw, y: top - px(8), w: 0, h: bottom - top + px(8), line: { color: i % 3 === 0 ? 'C4C4C4' : 'E6E6E6', width: 0.5 } });
      const total = sl.lanes.reduce((a, l) => a + l.rows, 0);
      const ppx = pipePitch(total, sl.lanes.length);
      const pitch = px(ppx);
      const fsz = Math.max(6.5, Math.min(9, ppx * PX * 72 * 0.55));
      let y = top;
      sl.lanes.forEach((l, li) => {
        const h = l.rows * pitch + px(PIPE.laneGap);
        if (li > 0) s.addShape('line', { x: px(20), y: y - px(6), w: px(1230), h: 0, line: { color: '111111', width: 1.5 } });
        s.addShape('rect', { x: px(20), y: y - px(2), w: px(46), h: h - px(8), fill: { type: 'none' } as any, line: { color: '888888', width: 1, dashType: 'dash' } });
        s.addText(l.label, { x: px(20), y: y - px(2), w: px(46), h: h - px(8), fontFace: FONT_T, fontSize: 8.5, bold: true, color: '333333', align: 'center', valign: 'middle', vert: 'vert270', margin: 0 } as any);
        for (const b of l.bars) {
          const bs = BAR_STATUS[b.status];
          const bx = TLX + (b.start / 12) * TLW, bw = Math.max(0.05, ((b.end - b.start) / 12) * TLW), by = y + b.row * pitch, bh = Math.max(px(10), pitch - px(3));
          s.addText(b.out === 'in' ? clean(b.label) : '', {
            x: bx, y: by, w: bw, h: bh, shape: 'roundRect' as any, rectRadius: 0.03, fill: { color: hex(bs.color) }, color: hex(bs.text),
            fontFace: FONT_B, fontSize: fsz, bold: true, margin: [0, 4, 0, 4], valign: 'middle', wrap: false,
          } as any);
          if (b.out === 'right') s.addText(clean(b.label), { x: bx + bw + px(6), y: by, w: px(b.label.length * 6.4 + 20), h: bh, fontFace: FONT_B, fontSize: fsz, bold: true, color: '2C2D2C', margin: 0, valign: 'middle', wrap: false });
          if (b.out === 'left') { const lw = px(b.label.length * 6.4 + 20); s.addText(clean(b.label), { x: bx - px(6) - lw, y: by, w: lw, h: bh, fontFace: FONT_B, fontSize: fsz, bold: true, color: '2C2D2C', margin: 0, valign: 'middle', align: 'right', wrap: false }); }
        }
        y += h;
      });
      const tx = TLX + (sl.today / 12) * TLW;
      s.addShape('line', { x: tx, y: top - px(6), w: 0, h: bottom - top + px(6), line: { color: 'E0301E', width: 1.5 } });
      s.addShape('ellipse', { x: tx - px(5), y: px(88), w: px(10), h: px(10), fill: { color: 'E0301E' }, line: { type: 'none' } });
      s.addText('Today', { x: tx + px(9), y: px(82), w: 0.7, h: 0.22, fontFace: FONT_B, fontSize: 9.5, bold: true, color: 'E0301E', margin: 0, valign: 'middle' });
      footer(s, sl);
    }
  }
  const out = await pres.write({ outputType: 'nodebuffer' });
  return out as Buffer;
}

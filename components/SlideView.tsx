import { BAR_STATUS, STATUS } from '@/lib/constants';
import type { Slide } from '@/lib/slides';
import type { Deck } from '@/lib/types';

const bold = (s: string) => ({ __html: String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') });
const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export function SlideView({ s, deck }: { s: Slide; deck: Deck }) {
  const bg = (url: string | null, over = true) => url && (
    <>
      <div className="bgimg" style={{ backgroundImage: `url(${url})` }} />
      {over && <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${deck.overlay / 100})` }} />}
    </>
  );
  if (s.kind === 'cover')
    return (
      <div className="slide dark">{bg(deck.bg_cover_url)}<div className="edge" />
        <div className="cover-logos">{deck.logo_left_url ? <img src={deck.logo_left_url} alt="" /> : <span />}{deck.logo_right_url ? <img src={deck.logo_right_url} alt="" /> : <span />}</div>
        <div className="big"><small>{deck.client.toUpperCase()}</small><h1>Weekly SAL</h1><p>{deck.subtitle} · {deck.date_label}</p></div>
      </div>
    );
  if (s.kind === 'section' || s.kind === 'closing')
    return (
      <div className="slide dark">{bg(deck.bg_divider_url)}<div className="edge" />
        <div className="sec">{s.kind === 'section' ? s.title : 'Grazie'}</div>
        {s.kind === 'closing' && deck.logo_left_url && <img src={deck.logo_left_url} alt="" style={{ position: 'absolute', left: 70, bottom: 70, height: 70 }} />}
      </div>
    );
  if (s.kind === 'table') {
    const tot = s.columns.reduce((a, c) => a + c.w, 0);
    return (
      <div className={'slide' + (s.theme === 'completed' ? ' completed' : '')}>
        {deck.bg_table_url && <div className="bgimg" style={{ backgroundImage: `url(${deck.bg_table_url})` }} />}
        <div className="edge" />
        <div className="ttl">{s.title}{s.part && <span className="part">({s.part})</span>}</div>
        {deck.logo_right_url && <img className="logoR" src={deck.logo_right_url} alt="" />}
        {s.legend && <div className="legend">{(['ontrack', 'delay', 'blocked', 'onhold'] as const).map((k) => <span key={k}><i style={{ background: STATUS[k].color }} />{STATUS[k].label}</span>)}</div>}
        <table>
          <colgroup>{s.columns.map((c, i) => <col key={i} style={{ width: `${(c.w / tot) * 100}%` }} />)}</colgroup>
          <thead><tr>{s.columns.map((c, i) => <th key={i} className={c.align === 'c' ? 'c' : ''}>{c.name}</th>)}</tr></thead>
          <tbody>{s.rows.map((r, ri) => (
            <tr key={ri}>{r.cells.map((t, ci) => ci === s.statusCol && r.status
              ? <td key={ci}><span className="st" style={{ background: STATUS[r.status].color, color: STATUS[r.status].text }}>{t}</span></td>
              : <td key={ci} className={s.columns[ci].align === 'c' ? 'c' : ''} dangerouslySetInnerHTML={bold(t)} />)}</tr>
          ))}</tbody>
        </table>
      </div>
    );
  }
  // pipeline
  const TLX = 96, TLW = 1150, mw = TLW / 12, top = 112, bottom = 680;
  const rowsPer = s.lanes.map((l) => Math.max(1, ...l.bars.map((b) => b.row + 1)));
  const total = rowsPer.reduce((a, b) => a + b, 0);
  const pitch = Math.min(24, (bottom - top - s.lanes.length * 10) / Math.max(1, total));
  let y = top + 6;
  return (
    <div className="slide"><div className="edge" />
      <div className="ttl">{s.title} {s.year}</div>
      <div className="pl-head">{MONTHS.map((m) => <div key={m}>{m}</div>)}</div>
      {Array.from({ length: 13 }, (_, i) => <div key={i} className={'pvl' + (i % 3 === 0 ? ' q' : '')} style={{ left: TLX + i * mw }} />)}
      {s.lanes.map((l, li) => {
        const y0 = y;
        y += rowsPer[li] * pitch + 10;
        return (
          <div key={l.label}>
            <div className="lane-lab" style={{ top: y0 }}>{l.label}</div>
            {l.bars.map((b, bi) => (
              <div key={bi} className="pbar" title={b.label} style={{
                left: TLX + (b.start / 12) * TLW, width: Math.max(6, ((b.end - b.start) / 12) * TLW), top: y0 + b.row * pitch, height: pitch - 3,
                background: BAR_STATUS[b.status].color, color: BAR_STATUS[b.status].text,
              }}>{b.label}</div>
            ))}
            <div className="lane-sep" style={{ top: y - 5 }} />
          </div>
        );
      })}
      <div className="today" style={{ left: TLX + (s.today / 12) * TLW }} />
    </div>
  );
}

export function Thumb({ s, deck, w = 300 }: { s: Slide; deck: Deck; w?: number }) {
  const k = w / 1280;
  return (
    <div style={{ width: w, height: 720 * k, overflow: 'hidden', borderRadius: 4, border: '1px solid #333743' }}>
      <div style={{ transform: `scale(${k})`, transformOrigin: '0 0', width: 1280, height: 720 }}><SlideView s={s} deck={deck} /></div>
    </div>
  );
}

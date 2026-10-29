import { BAR_STATUS, STATUS, type BarStatus } from '@/lib/constants';
import { Prio } from '@/lib/prio';
import { PIPE, pipePitch, type Slide } from '@/lib/slides';
import type { Deck } from '@/lib/types';

const esc = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
// **grassetto** e "(next step: …)" in grassetto, come nel deck originale
export const rich = (s: string) => ({
  __html: esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\(\s*next\s*step[^)]*\)/gi, '<b>$&</b>')
    .replace(/\n/g, '<br/>'),
});
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const TL = { x: 78, w: 1170 };

function Foot({ deck, no }: { deck: Deck; no?: number }) {
  return <div className="foot"><span>{deck.subtitle} · {deck.date_label}</span><span>{no ?? ''}</span></div>;
}

export function SlideView({ s, deck, no }: { s: Slide; deck: Deck; no?: number }) {
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
        <div className="sec">{s.kind === 'section' ? s.title : 'Thank you'}</div>
        {s.kind === 'closing' && deck.logo_left_url && <img src={deck.logo_left_url} alt="" style={{ position: 'absolute', left: 70, bottom: 70, height: 70 }} />}
      </div>
    );
  if (s.kind === 'table') {
    const tot = s.columns.reduce((a, c) => a + c.w, 0);
    return (
      <div className="slide">
        {deck.bg_table_url && <div className="bgimg" style={{ backgroundImage: `url(${deck.bg_table_url})` }} />}
        <div className="edge" style={s.theme === 'completed' ? { background: '#7135A8' } : undefined} />
        <div className="ttl">{s.title}{s.part && <span className="part">({s.part})</span>}</div>
        {deck.logo_right_url && <img className="logoR" src={deck.logo_right_url} alt="" />}
        {s.legend && <div className="legend">{(['ontrack', 'delay', 'blocked', 'onhold'] as const).map((k) => <span key={k}><i style={{ background: STATUS[k].color }} />{STATUS[k].label}</span>)}</div>}
        <table>
          <colgroup>{s.columns.map((c, i) => <col key={i} style={{ width: `${(c.w / tot) * 100}%` }} />)}</colgroup>
          <thead><tr>{s.columns.map((c, i) => <th key={i} className={c.align === 'c' ? 'c' : ''}>{c.name}</th>)}</tr></thead>
          <tbody>{s.rows.map((r, ri) => {
            const st = r.status ? STATUS[r.status] : null;
            return (
              <tr key={ri}>{r.cells.map((t, ci) => {
                if (ci === 0 && st && !r.ams)
                  return <td key={ci} className={s.theme === 'completed' ? 'c' : 'idc'} style={{ background: st.tint, color: st.ink, boxShadow: `inset 7px 0 0 ${st.stripe}`, fontWeight: 800 }}>{t}</td>;
                if (ci === 0 && st)
                  return <td key={ci} className="idc" style={{ background: st.tint, color: st.ink, boxShadow: `inset 7px 0 0 ${st.stripe}`, verticalAlign: 'top', paddingTop: 12 }}>{t}</td>;
                if (r.ams && ci === 1)
                  return (
                    <td key={ci} className="amscell">
                      <div className="amst">{t}</div>
                      <ul className="amsl">{r.ams.map((a, k) => <li key={k}>{a.t} <b>({a.tag})</b></li>)}</ul>
                    </td>
                  );
                if (ci === s.prioCol) return <td key={ci} className="c"><Prio p={t} size={15} /></td>;
                if (ci === s.statusCol) return <td key={ci} className="act">{t}</td>;
                return <td key={ci} className={s.columns[ci].align === 'c' ? 'c' : ''} dangerouslySetInnerHTML={rich(t)} />;
              })}</tr>
            );
          })}</tbody>
        </table>
        <Foot deck={deck} no={no} />
      </div>
    );
  }
  // ---- pipeline (stile deck originale) ----
  const { x: TLX, w: TLW } = TL;
  const mw = TLW / 12, top = PIPE.top, bottom = PIPE.bottom;
  const total = s.lanes.reduce((a, l) => a + l.rows, 0);
  const pitch = pipePitch(total, s.lanes.length);
  const fs = Math.max(8.5, Math.min(11.5, pitch * 0.62));
  const barH = Math.max(10, pitch - 3);
  let y = top;
  const boxes = s.lanes.map((l, i) => { const h = l.rows * pitch + PIPE.laneGap; const b = { l, y, h, i }; y += h; return b; });
  const tx = TLX + (s.today / 12) * TLW;
  return (
    <div className="slide"><div className="edge" />
      <div className="ttl">{s.title} {s.year}{s.part && <span className="part">({s.part})</span>}</div>
      <div className="legend" style={{ left: 'auto', right: 40, top: 30 }}>
        {(Object.keys(BAR_STATUS) as BarStatus[]).map((k) => <span key={k}><i style={{ background: BAR_STATUS[k].color }} />{BAR_STATUS[k].label}</span>)}
      </div>
      {[0, 1, 2, 3].map((q) => <div key={q} className="pq" style={{ left: TLX + q * 3 * mw, width: 3 * mw }}>{s.year} - Q{q + 1}</div>)}
      {MONTHS.map((m, i) => <div key={m} className="pm" style={{ left: TLX + i * mw, width: mw }}>{m}</div>)}
      {Array.from({ length: 13 }, (_, i) => <div key={i} className={'pvl' + (i % 3 === 0 ? ' q' : '')} style={{ left: TLX + i * mw, top: top - 8, height: bottom - top + 8 }} />)}
      {boxes.map(({ l, y: y0, h, i }) => (
        <div key={l.label}>
          {i > 0 && <div className="lane-sep" style={{ top: y0 - 6 }} />}
          <div className="lane-box" style={{ top: y0 - 2, height: h - 8 }}><span>{l.label}</span></div>
          {l.bars.map((b, bi) => {
            const x = TLX + (b.start / 12) * TLW, w = Math.max(6, ((b.end - b.start) / 12) * TLW);
            const by = y0 + b.row * pitch;
            return (
              <div key={bi}>
                <div className="pbar" title={b.label} style={{ left: x, width: w, top: by, height: barH, fontSize: fs, background: BAR_STATUS[b.status].color, color: BAR_STATUS[b.status].text }}>
                  {b.out === 'in' ? b.label : ''}
                </div>
                {b.out === 'right' && <div className="pout" style={{ left: x + w + 6, top: by, height: barH, fontSize: fs }}>{b.label}</div>}
                {b.out === 'left' && <div className="pout" style={{ right: 1280 - x + 6, top: by, height: barH, fontSize: fs }}>{b.label}</div>}
              </div>
            );
          })}
        </div>
      ))}
      <div className="today" style={{ left: tx - 1, top: top - 6, height: bottom - top + 6 }} />
      <div className="today-dot" style={{ left: tx - 5, top: 88 }} />
      <div className="today-tag" style={{ left: tx + 10, top: 84 }}>Today</div>
      <Foot deck={deck} no={no} />
    </div>
  );
}

export function Thumb({ s, deck, w = 300, no }: { s: Slide; deck: Deck; w?: number; no?: number }) {
  const k = w / 1280;
  return (
    <div style={{ width: w, height: 720 * k, overflow: 'hidden', borderRadius: 4, border: '1px solid var(--line)' }}>
      <div style={{ transform: `scale(${k})`, transformOrigin: '0 0', width: 1280, height: 720 }}><SlideView s={s} deck={deck} no={no} /></div>
    </div>
  );
}

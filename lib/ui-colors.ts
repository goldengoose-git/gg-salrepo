// Colori personalizzabili SOLO per l'interfaccia interna. Slide, anteprima, PDF e PPTX usano sempre i colori di constants.ts.
import { AMS_KEYS, AMS_STATUS, BAR_STATUS, STATUS, STATUS_KEYS, type AmsStatus, type BarStatus, type Status } from './constants';
import type { ColorPair, UiColors } from './types';

const HEX = /^#[0-9a-fA-F]{6}$/;

export const uiStatus = (u: UiColors | undefined, s: Status): ColorPair => ({ color: u?.status?.[s]?.color ?? STATUS[s].color, text: u?.status?.[s]?.text ?? STATUS[s].text });
export const uiAms = (u: UiColors | undefined, s: AmsStatus): ColorPair => ({ color: u?.ams?.[s]?.color ?? AMS_STATUS[s].color, text: u?.ams?.[s]?.text ?? AMS_STATUS[s].text });
export const uiBar = (u: UiColors | undefined, s: BarStatus): ColorPair => ({ color: u?.bar?.[s]?.color ?? BAR_STATUS[s].color, text: u?.bar?.[s]?.text ?? BAR_STATUS[s].text });

/** Tiene solo chiavi note e colori esadecimali #RRGGBB; scarta il resto. */
export function sanitizeColors(input: any): UiColors {
  const out: UiColors = {};
  const pick = (src: any, keys: string[]) => {
    const r: Record<string, ColorPair> = {};
    for (const k of keys) {
      const v = src?.[k];
      if (v && HEX.test(String(v.color)) && HEX.test(String(v.text))) r[k] = { color: String(v.color).toUpperCase(), text: String(v.text).toUpperCase() };
    }
    return r;
  };
  const s = pick(input?.status, STATUS_KEYS);
  const a = pick(input?.ams, AMS_KEYS);
  const b = pick(input?.bar, Object.keys(BAR_STATUS));
  if (Object.keys(s).length) out.status = s;
  if (Object.keys(a).length) out.ams = a;
  if (Object.keys(b).length) out.bar = b;
  return out;
}

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
/** Rapporto di contrasto WCAG tra sfondo e testo (1-21). */
export function contrast(bg: string, fg: string) {
  if (!HEX.test(bg) || !HEX.test(fg)) return 1;
  const a = lum(bg), b = lum(fg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

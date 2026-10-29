export type LookupKind = 'type_mc' | 'type_sc' | 'owner' | 'contract_label';
export const KINDS: { kind: LookupKind; title: string; hint: string }[] = [
  { kind: 'type_mc', title: 'Type · Marketing Cloud', hint: 'Valori del campo Type delle azioni MC (es. CJ, Campaign, Set Up)' },
  { kind: 'type_sc', title: 'Type · Service Cloud', hint: 'Valori del campo Type delle azioni SC' },
  { kind: 'owner', title: 'Owner', hint: 'Persone con prefisso team, es. CRM: Saladino, IT: Glave' },
  { kind: 'contract_label', title: 'Contract · stato offerta', hint: 'Etichette da abbinare a OPEX o CAPEX, es. Offerta da emettere, Offerta firmata' },
];

// "CRM: Saladino, Barile / IT: Glave" -> ["CRM: Saladino","CRM: Barile","IT: Glave"]
export function parseOwners(s: string): string[] {
  const out: string[] = [];
  for (const part of String(s ?? '').split(/\s*[\/;]\s*/)) {
    const m = part.match(/^([^:,]+?)\s*:\s*(.*)$/);
    if (m) for (const n of m[2].split(',').map((x) => x.trim()).filter(Boolean)) out.push(`${m[1].trim()}: ${n}`);
    else for (const n of part.split(',').map((x) => x.trim()).filter(Boolean)) out.push(n);
  }
  return [...new Set(out)];
}
// ["CRM: A","CRM: B","IT: C"] -> "CRM: A, B / IT: C"
export function joinOwners(list: string[]): string {
  const order: string[] = [];
  const groups = new Map<string, string[]>();
  for (const o of list) {
    const m = o.match(/^([^:]+?)\s*:\s*(.+)$/);
    const key = m ? m[1].trim() : '\u0000' + o;
    if (!groups.has(key)) { groups.set(key, []); order.push(key); }
    groups.get(key)!.push(m ? m[2].trim() : o);
  }
  return order.map((k) => (k.startsWith('\u0000') ? groups.get(k)![0] : `${k}: ${groups.get(k)!.join(', ')}`)).join(' / ');
}

// Stima: numero (giorni) oppure "-"
export function normEstimate(s: any): string {
  const t = String(s ?? '').trim().replace(',', '.');
  const m = t.match(/^(\d+(?:\.\d+)?)\s*(?:md|gg|d)?$/i);
  return m ? String(Number(m[1])) : '-';
}
export function fmtEstimate(s: any): string {
  const n = normEstimate(s);
  return n === '-' ? '-' : `${n} MD`;
}
export const contractKind = (s: string): 'opex' | 'capex' | null => {
  const t = String(s ?? '').trim().toLowerCase();
  return t === 'opex' ? 'opex' : t === 'capex' ? 'capex' : null;
};

// Contract = [OPEX|CAPEX] [– etichetta]: "CAPEX – Offerta da emettere", "Offerta firmata", "OPEX"
export function parseContract(s: string): { type: '' | 'OPEX' | 'CAPEX'; label: string } {
  const t = String(s ?? '').trim();
  const m = t.match(/^(opex|capex)\s*(?:[–—-]\s*(.*))?$/i);
  if (m) return { type: m[1].toUpperCase() as 'OPEX' | 'CAPEX', label: (m[2] ?? '').trim() };
  return { type: '', label: t };
}
export function joinContract(type: string, label: string): string {
  const l = label.trim();
  return type && l ? `${type} – ${l}` : type || l;
}

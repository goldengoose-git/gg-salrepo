import { DONE_RE, STATUS_KEYS, type Area, type Status } from './constants';

const TXT = ['code', 'type', 'description', 'priority', 'requested_date', 'golive_date', 'owner', 'estimate', 'contract', 'activity'] as const;

export type ItemInput = Partial<Record<(typeof TXT)[number], string>> & { status?: Status };

// pulisce l'input: solo campi ammessi, "(done)" a fine descrizione => completed
export function cleanItem(area: Area, b: any): ItemInput {
  const o: ItemInput = {};
  for (const k of TXT) if (typeof b?.[k] === 'string') o[k] = b[k].slice(0, 2000);
  if (STATUS_KEYS.includes(b?.status)) o.status = b.status;
  if (area === 'AMS' && o.description && DONE_RE.test(o.description)) {
    o.description = o.description.replace(DONE_RE, '').trim();
    o.status = 'completed';
  }
  return o;
}
export { TXT };

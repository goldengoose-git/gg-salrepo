import { normEstimate } from './lookups';
import { AMS_KEYS, AMS_STATUS, DONE_RE, STATUS_KEYS, type AmsStatus, type Area, type Status } from './constants';

const TXT = ['code', 'type', 'description', 'priority', 'requested_date', 'golive_date', 'release_date', 'owner', 'estimate', 'contract', 'activity'] as const;

export type ItemInput = Partial<Record<(typeof TXT)[number], string>> & { status?: Status; ams_status?: AmsStatus };

// pulisce l'input: solo campi ammessi, "(done)" a fine descrizione => completed
export function cleanItem(area: Area, b: any): ItemInput {
  const o: ItemInput = {};
  for (const k of TXT) if (typeof b?.[k] === 'string') o[k] = b[k].slice(0, 2000);
  if (o.estimate !== undefined) o.estimate = normEstimate(o.estimate);
  if (STATUS_KEYS.includes(b?.status)) o.status = b.status;
  if (area === 'AMS') {
    // ticket AMS: lo stato è quello Jira (New, WIP, Waiting for feedback, Testing, Ready to deploy, Done); `status` ne deriva
    if (AMS_KEYS.includes(b?.ams_status)) o.ams_status = b.ams_status;
    if (o.description && DONE_RE.test(o.description)) {
      o.description = o.description.replace(DONE_RE, '').trim();
      o.ams_status = 'done';
    }
    if (o.ams_status) o.status = AMS_STATUS[o.ams_status].status;
    else if (o.status === 'completed') o.ams_status = 'done';
  }
  return o;
}
export { TXT };

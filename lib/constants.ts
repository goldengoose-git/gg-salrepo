export type Role = 'MC' | 'SC' | 'ADMIN';
export type Area = 'MC' | 'SC' | 'AMS';
export type Status = 'ontrack' | 'delay' | 'blocked' | 'onhold' | 'completed';
export type AmsStatus = 'new' | 'wip' | 'waiting' | 'testing' | 'ready' | 'done';
export type BarStatus = 'completed' | 'wip' | 'analysis' | 'estimate';
export type Lane = 'SFMC' | 'CROSS' | 'SFSC';

export const STATUS: Record<Status, { label: string; color: string; text: string; stripe: string; tint: string; ink: string }> = {
  ontrack: { label: 'On Track', color: '#34A853', text: '#111111', stripe: '#4FA35B', tint: '#E6F1E8', ink: '#2F7A3B' },
  delay: { label: 'Delay', color: '#FBBC04', text: '#111111', stripe: '#E9A800', tint: '#FFF3D1', ink: '#8A5F00' },
  blocked: { label: 'Blocked', color: '#E0301E', text: '#FFFFFF', stripe: '#D2402B', tint: '#F8E0DC', ink: '#A52B18' },
  onhold: { label: 'On Hold', color: '#CCCCCC', text: '#111111', stripe: '#BDBDBD', tint: '#F4F4F4', ink: '#666666' },
  completed: { label: 'Completed', color: '#7135A8', text: '#FFFFFF', stripe: '#7135A8', tint: '#EEE4F6', ink: '#5A2A86' },
};
export const STATUS_KEYS = Object.keys(STATUS) as Status[];

// Stati dei ticket AMS, come nel workflow Jira. `status` interno (colore/severità in slide) deriva da questi.
export const AMS_STATUS: Record<AmsStatus, { label: string; color: string; text: string; status: Status }> = {
  new: { label: 'New', color: '#8A94A6', text: '#FFFFFF', status: 'ontrack' },
  wip: { label: 'WIP', color: '#2F6FDE', text: '#FFFFFF', status: 'ontrack' },
  waiting: { label: 'Waiting for feedback', color: '#E9A800', text: '#111111', status: 'delay' },
  testing: { label: 'Testing', color: '#7135A8', text: '#FFFFFF', status: 'ontrack' },
  ready: { label: 'Ready to deploy', color: '#0E9F8E', text: '#FFFFFF', status: 'ontrack' },
  done: { label: 'Done', color: '#34A853', text: '#FFFFFF', status: 'completed' },
};
export const AMS_KEYS = Object.keys(AMS_STATUS) as AmsStatus[];
/** Stato Jira (qualsiasi dicitura) -> stato AMS dell'app. */
export function jiraStatus(raw: string | null | undefined): AmsStatus | null {
  const t = String(raw ?? '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (/^(done|closed|resolved|complete|completed|chius\w*)$/.test(t)) return 'done';
  if (/ready.*(deploy|release|prod)/.test(t)) return 'ready';
  if (/test|qa|uat/.test(t)) return 'testing';
  if (/wait|feedback|hold|pending|blocked|sospes|attesa/.test(t)) return 'waiting';
  if (/wip|progress|working|develop|analy|review|corso/.test(t)) return 'wip';
  if (/^(new|open|to do|todo|backlog|created|nuovo|selected for development)$/.test(t)) return 'new';
  return null;
}

export const BAR_STATUS: Record<BarStatus, { label: string; color: string; text: string }> = {
  completed: { label: 'Completed', color: '#34A853', text: '#FFFFFF' },
  wip: { label: 'WIP', color: '#EFA200', text: '#FFFFFF' },
  analysis: { label: 'Analysis', color: '#E0301E', text: '#FFFFFF' },
  estimate: { label: 'Estimate', color: '#E9E9E9', text: '#222222' },
};

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
export const LANES: Lane[] = ['SFMC', 'CROSS', 'SFSC'];
export const MAX_ROWS = 12;

export const areasFor = (r: Role): Area[] => (r === 'ADMIN' ? ['MC', 'SC', 'AMS'] : r === 'MC' ? ['MC'] : ['SC', 'AMS']);
export const lanesFor = (r: Role): Lane[] => (r === 'ADMIN' ? ['SFMC', 'CROSS', 'SFSC'] : r === 'MC' ? ['SFMC', 'CROSS'] : ['SFSC']);

export type Col = { name: string; w: number; align: 'l' | 'c' };
export const COLS: Record<'mc' | 'sc' | 'ams' | 'amsblock' | 'completed', Col[]> = {
  mc: [
    { name: 'ID', w: 5, align: 'c' }, { name: 'Type', w: 8, align: 'c' }, { name: 'Description', w: 32, align: 'l' },
    { name: 'Priorità', w: 7, align: 'c' }, { name: 'Requested date', w: 8, align: 'c' }, { name: 'GoLive Date', w: 8, align: 'c' },
    { name: 'Owner', w: 10, align: 'l' }, { name: 'Stima', w: 6, align: 'c' }, { name: 'Contract Type & Status', w: 11, align: 'l' },
    { name: 'Activity Status', w: 10, align: 'c' },
  ],
  sc: [
    { name: 'ID', w: 5, align: 'c' }, { name: 'Description', w: 37, align: 'l' }, { name: 'Priorità', w: 7, align: 'c' },
    { name: 'Requested date', w: 8, align: 'c' }, { name: 'GoLive Date', w: 8, align: 'c' }, { name: 'Owner', w: 10, align: 'l' },
    { name: 'Stima', w: 6, align: 'c' }, { name: 'Contract Type & Status', w: 12, align: 'l' }, { name: 'Activity Status', w: 10, align: 'c' },
  ],
  ams: [
    { name: 'ID', w: 5, align: 'c' }, { name: 'Ticket', w: 10, align: 'c' }, { name: 'Subject', w: 38, align: 'l' },
    { name: 'Priorità', w: 9, align: 'c' }, { name: 'Owner', w: 14, align: 'l' }, { name: 'Opened', w: 10, align: 'c' },
    { name: 'Activity Status', w: 14, align: 'c' },
  ],
  amsblock: [
    { name: 'ID', w: 5, align: 'c' }, { name: 'Description', w: 62, align: 'l' }, { name: 'Stima', w: 7, align: 'c' },
    { name: 'Contract Type & Status', w: 14, align: 'l' }, { name: 'Activity Status', w: 12, align: 'c' },
  ],
  completed: [
    { name: 'Type', w: 8, align: 'c' }, { name: 'Description', w: 35, align: 'l' }, { name: 'Priorità', w: 7, align: 'c' },
    { name: 'GoLive Date', w: 8, align: 'c' }, { name: 'Owner', w: 11, align: 'l' }, { name: 'Stima', w: 6, align: 'c' },
    { name: 'Contract Type & Status', w: 12, align: 'l' }, { name: 'Activity Status', w: 9, align: 'c' },
  ],
};

export const DONE_RE = /\(\s*\*{0,2}\s*done\s*\*{0,2}\s*\)\s*$/i;

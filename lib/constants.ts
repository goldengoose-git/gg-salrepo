export type Role = 'MC' | 'SC';
export type Area = 'MC' | 'SC' | 'AMS';
export type Status = 'ontrack' | 'delay' | 'blocked' | 'onhold' | 'completed';
export type BarStatus = 'completed' | 'wip' | 'analysis' | 'estimate';
export type Lane = 'SFMC' | 'CROSS' | 'SFSC';

export const STATUS: Record<Status, { label: string; color: string; text: string }> = {
  ontrack: { label: 'On Track', color: '#34A853', text: '#111111' },
  delay: { label: 'Delay', color: '#FBBC04', text: '#111111' },
  blocked: { label: 'Blocked', color: '#E0301E', text: '#FFFFFF' },
  onhold: { label: 'On Hold', color: '#CCCCCC', text: '#111111' },
  completed: { label: 'Completed', color: '#7135A8', text: '#FFFFFF' },
};
export const STATUS_KEYS = Object.keys(STATUS) as Status[];

export const BAR_STATUS: Record<BarStatus, { label: string; color: string; text: string }> = {
  completed: { label: 'Completed', color: '#34A853', text: '#FFFFFF' },
  wip: { label: 'WIP', color: '#EFA200', text: '#FFFFFF' },
  analysis: { label: 'Analysis', color: '#E0301E', text: '#FFFFFF' },
  estimate: { label: 'Estimate', color: '#E9E9E9', text: '#222222' },
};

export const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
export const LANES: Lane[] = ['SFMC', 'CROSS', 'SFSC'];
export const MAX_ROWS = 12;

export const areasFor = (r: Role): Area[] => (r === 'MC' ? ['MC'] : ['SC', 'AMS']);
export const lanesFor = (r: Role): Lane[] => (r === 'MC' ? ['SFMC', 'CROSS'] : ['SFSC']);

export type Col = { name: string; w: number; align: 'l' | 'c' };
export const COLS: Record<'mc' | 'sc' | 'ams' | 'completed', Col[]> = {
  mc: [
    { name: 'ID', w: 5, align: 'c' }, { name: 'Type', w: 9, align: 'c' }, { name: 'Description', w: 27, align: 'l' },
    { name: 'Priorità', w: 8, align: 'c' }, { name: 'Requested date', w: 8, align: 'c' }, { name: 'GoLive Date', w: 8, align: 'c' },
    { name: 'Owner', w: 11, align: 'l' }, { name: 'Stima', w: 6, align: 'c' }, { name: 'Contract Type & Status', w: 12, align: 'l' },
    { name: 'Activity Status', w: 10, align: 'c' },
  ],
  sc: [
    { name: 'ID', w: 5, align: 'c' }, { name: 'Description', w: 32, align: 'l' }, { name: 'Priorità', w: 8, align: 'c' },
    { name: 'Requested date', w: 9, align: 'c' }, { name: 'GoLive Date', w: 9, align: 'c' }, { name: 'Owner', w: 11, align: 'l' },
    { name: 'Stima', w: 6, align: 'c' }, { name: 'Contract Type & Status', w: 12, align: 'l' }, { name: 'Activity Status', w: 10, align: 'c' },
  ],
  ams: [
    { name: 'ID', w: 5, align: 'c' }, { name: 'Ticket', w: 10, align: 'c' }, { name: 'Subject', w: 38, align: 'l' },
    { name: 'Priorità', w: 9, align: 'c' }, { name: 'Owner', w: 14, align: 'l' }, { name: 'Opened', w: 10, align: 'c' },
    { name: 'Activity Status', w: 14, align: 'c' },
  ],
  completed: [
    { name: 'Type', w: 8, align: 'c' }, { name: 'Description', w: 35, align: 'l' }, { name: 'Priorità', w: 7, align: 'c' },
    { name: 'GoLive Date', w: 8, align: 'c' }, { name: 'Owner', w: 11, align: 'l' }, { name: 'Stima', w: 6, align: 'c' },
    { name: 'Contract Type & Status', w: 12, align: 'l' }, { name: 'Activity Status', w: 9, align: 'c' },
  ],
};

export const DONE_RE = /\(\s*\*{0,2}\s*done\s*\*{0,2}\s*\)\s*$/i;

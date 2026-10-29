import type { Role } from './constants';
// MC gestisce i Type MC, SC i Type SC; gli Owner sono condivisi
export const canManage = (role: Role, kind: string) => kind === 'owner' || (kind === 'type_mc' && role === 'MC') || (kind === 'type_sc' && role === 'SC');

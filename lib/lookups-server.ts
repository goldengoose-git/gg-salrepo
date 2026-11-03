import type { Role } from './constants';
// MC gestisce i Type MC, SC i Type SC; gli Owner sono condivisi
export const canManage = (role: Role, kind: string) => role === 'ADMIN' || kind === 'owner' || kind === 'contract_label' || (kind === 'type_mc' && role === 'MC') || (kind === 'type_sc' && role === 'SC');

import type { AmsStatus, Area, BarStatus, Lane, Role, Status } from './constants';

export type ColorPair = { color: string; text: string };
/** Colori personalizzati SOLO per l'interfaccia interna (non per slide, PPTX, PDF). */
export type UiColors = { status?: Partial<Record<Status, ColorPair>>; ams?: Partial<Record<AmsStatus, ColorPair>>; bar?: Partial<Record<BarStatus, ColorPair>>; contract?: Partial<Record<'OPEX' | 'CAPEX', ColorPair>> };

export type Deck = {
  id: string; week_label: string; sal_date: string | null; client: string; subtitle: string; date_label: string; year: number;
  logo_left_url: string | null; logo_right_url: string | null;
  bg_cover_url: string | null; bg_divider_url: string | null; bg_table_url: string | null;
  overlay: number; status: string; published_at: string | null; created_at: string;
  export_status?: 'ok' | 'error' | null; export_at?: string | null; export_url?: string | null; export_error?: string | null;
};
export type Item = {
  id: string; deck_id: string; area: Area; position: number; code: string; type: string; description: string;
  priority: string; requested_date: string; golive_date: string; release_date: string; ams_status: AmsStatus | null; owner: string; estimate: string; contract: string; activity: string;
  status: Status; archived_at: string | null; closed_at: string | null; updated_by: string | null; updated_at: string;
};
export type Bar = {
  id: string; deck_id: string; lane: Lane; label: string; status: BarStatus; start_m: number; end_m: number; row: number;
};
export type SnapshotRow = { id: string; week_label: string; created_by: string | null; created_at: string; export_url?: string | null };
export type Lookup = { id: string; kind: 'type_mc' | 'type_sc' | 'owner' | 'contract_label'; value: string; position: number };
export type TeamStatus = { team: 'MC' | 'SC'; done_at: string; done_by: string | null };
export type AppState = { deck: Deck; items: Item[]; bars: Bar[]; snapshots: SnapshotRow[]; lookups: Lookup[]; teamStatus: TeamStatus[]; uiColors: UiColors };
export type Me = { username: string; role: Role; name: string; iat?: number };

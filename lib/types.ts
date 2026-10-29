import type { Area, BarStatus, Lane, Status } from './constants';

export type Deck = {
  id: string; week_label: string; sal_date: string | null; client: string; subtitle: string; date_label: string; year: number;
  logo_left_url: string | null; logo_right_url: string | null;
  bg_cover_url: string | null; bg_divider_url: string | null; bg_table_url: string | null;
  overlay: number; status: string; published_at: string | null; created_at: string;
};
export type Item = {
  id: string; deck_id: string; area: Area; position: number; code: string; type: string; description: string;
  priority: string; requested_date: string; golive_date: string; owner: string; estimate: string; contract: string; activity: string;
  status: Status; archived_at: string | null; closed_at: string | null; updated_by: string | null; updated_at: string;
};
export type Bar = {
  id: string; deck_id: string; lane: Lane; label: string; status: BarStatus; start_m: number; end_m: number; row: number;
};
export type SnapshotRow = { id: string; week_label: string; created_by: string | null; created_at: string };
export type Lookup = { id: string; kind: 'type_mc' | 'type_sc' | 'owner' | 'contract_label'; value: string; position: number };
export type TeamStatus = { team: 'MC' | 'SC'; done_at: string; done_by: string | null };
export type AppState = { deck: Deck; items: Item[]; bars: Bar[]; snapshots: SnapshotRow[]; lookups: Lookup[]; teamStatus: TeamStatus[] };
export type Me = { username: string; role: 'MC' | 'SC'; name: string };

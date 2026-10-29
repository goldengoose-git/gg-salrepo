create table if not exists users (
  id serial primary key,
  username text unique not null,
  role text not null check (role in ('MC','SC')),
  display_name text not null,
  password_hash text not null
);

create table if not exists decks (
  id uuid primary key default gen_random_uuid(),
  week_label text not null,
  client text not null default 'Golden Goose',
  subtitle text not null default 'Status Update',
  date_label text not null default '',
  year int not null default 2026,
  logo_left_url text,
  logo_right_url text,
  bg_cover_url text,
  bg_divider_url text,
  bg_table_url text,
  overlay int not null default 40,
  status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  area text not null check (area in ('MC','SC','AMS')),
  position int not null default 0,
  code text not null default '',
  type text not null default '',
  description text not null default '',
  priority text not null default '',
  requested_date text not null default '',
  golive_date text not null default '',
  owner text not null default '',
  estimate text not null default '',
  contract text not null default '',
  activity text not null default '',
  status text not null default 'ontrack' check (status in ('ontrack','delay','blocked','onhold','completed')),
  archived_at timestamptz,
  closed_at timestamptz,
  updated_by text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists items_deck_idx on items(deck_id, area, archived_at);

create table if not exists pipeline_bars (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references decks(id) on delete cascade,
  lane text not null check (lane in ('SFMC','CROSS','SFSC')),
  label text not null default '',
  status text not null default 'wip' check (status in ('completed','wip','analysis','estimate')),
  start_m numeric(5,2) not null default 0,
  end_m numeric(5,2) not null default 1,
  row int not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);

create index if not exists bars_deck_idx on pipeline_bars(deck_id, lane);

create table if not exists snapshots (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid references decks(id) on delete set null,
  week_label text not null,
  payload jsonb not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_name text not null,
  action text not null,
  entity text not null,
  entity_id text,
  detail jsonb
);

alter table items add column if not exists activity text not null default '';
;
create table if not exists settings (
  key text primary key,
  value text
)
;
create table if not exists lookups (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('type_mc','type_sc','owner')),
  value text not null,
  position int not null default 0,
  unique (kind, value)
);
;
alter table lookups drop constraint if exists lookups_kind_check
;
alter table lookups add constraint lookups_kind_check check (kind in ('type_mc','type_sc','owner','contract_label'))
;
alter table decks add column if not exists sal_date text
;
create table if not exists team_status (
  deck_id uuid not null references decks(id) on delete cascade,
  team text not null check (team in ('MC','SC')),
  done_at timestamptz not null default now(),
  done_by text,
  primary key (deck_id, team)
);
;
create table if not exists login_attempts (
  id bigserial primary key,
  ip text not null,
  username text not null,
  ok boolean not null default false,
  at timestamptz not null default now()
)
;
create index if not exists login_attempts_ip_at on login_attempts (ip, at desc)
;
create index if not exists login_attempts_user_at on login_attempts (username, at desc)

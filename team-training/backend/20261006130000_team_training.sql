-- Team Training tile: short training sessions on the phone (the content lives in the portal repo, team-training/sessions),
-- and the record of who has done what.
--   training_people   which departments someone works in, so we know which sessions are required of them
--   training_records  every time a session is finished: score, pass or fail, session version, when
--   training_certs    external certificates a session cannot replace (Level 2 food hygiene, first aid at work...)
-- RLS on, no policies: the service-role edge function (training-api) is the only way in.
-- Tabs: "My training" is for everyone with the tile; "Training record" (everyone's progress) is only for a person who has that
-- tab ticked in Settings > Users, or an admin. A person with no tab rows sees "My training" only.

create table if not exists training_people (
  email        text primary key,
  departments  text[] not null default '{}',
  updated_by   text not null default '',
  updated_at   timestamptz not null default now()
);
alter table training_people enable row level security;

create table if not exists training_records (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  name            text not null default '',
  session_key     text not null,
  session_version int  not null default 1,
  score           int  not null default 0,
  total           int  not null default 0,
  passed          boolean not null default false,
  seconds         int,
  completed_at    timestamptz not null default now()
);
alter table training_records enable row level security;
create index if not exists training_records_person_idx  on training_records (email, session_key, completed_at desc);
create index if not exists training_records_session_idx on training_records (session_key, completed_at desc);

create table if not exists training_certs (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  cert_key     text not null,           -- food-hygiene-l2 | first-aid-at-work | emergency-first-aid | personal-licence | fire-marshal | allergen | other
  cert_label   text not null default '',
  obtained_on  date,
  expires_on   date,
  note         text not null default '',
  recorded_by  text not null default '',
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
alter table training_certs enable row level security;
create index if not exists training_certs_person_idx on training_certs (email) where deleted_at is null;

-- Per-session settings. A session counts as "issued" from issued_at: everyone it is required of must pass it within
-- grace_days (default 7) of that date (or of the day they joined, if later), and then again every refresh_months
-- (default 12). A pass made before issued_at does not count, so "re-issue" makes everyone do it again.
create table if not exists training_settings (
  session_key    text primary key,
  refresh_months int  not null default 12 check (refresh_months between 1 and 60),
  grace_days     int  not null default 7  check (grace_days between 1 and 60),
  issued_at      timestamptz,
  updated_by     text not null default '',
  updated_at     timestamptz not null default now()
);
alter table training_settings enable row level security;

-- One row: the switch for the automatic overdue emails.
create table if not exists training_config (
  id            int primary key default 1 check (id = 1),
  reminders_on  boolean not null default true,
  updated_by    text not null default '',
  updated_at    timestamptz not null default now()
);
alter table training_config enable row level security;
insert into training_config (id) values (1) on conflict do nothing;

-- Each overdue email sent, so nobody is emailed more than once a week.
create table if not exists training_reminders (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  session_keys text[] not null default '{}',
  sent_at      timestamptz not null default now()
);
alter table training_reminders enable row level security;
create index if not exists training_reminders_idx on training_reminders (email, sent_at desc);

insert into portal_apps (key, label, description, icon, url, app_password, color, sort_order, active) values
  ('team-training', 'Team Training', 'Short training sessions on your phone: fire safety, manual handling, food and allergens, licensing and more, with a record of who has done what',
   'training', 'https://app.blackhorsebeamish.co.uk/team-training/', 'Tr4in#team26', '#4E5F4F', 19, true)
on conflict (key) do nothing;

insert into portal_app_tabs (app_key, tab_key, label, editable, sort_order) values
  ('team-training', 'learn',  'My training',     false, 1),
  ('team-training', 'record', 'Training record', true,  2)
on conflict (app_key, tab_key) do nothing;

insert into portal_user_access (user_id, app_key, can_edit)
select id, 'team-training', true from portal_users where email = 'gm@blackhorsebeamish.co.uk'
on conflict do nothing;

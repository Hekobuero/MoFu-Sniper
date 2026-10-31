-- =====================================================================
--  MoFu Sniper – Bestenliste "Wer schießt die meiste Provision ab"
--  Einmalig im Supabase-Dashboard ausführen: SQL Editor → New query →
--  diesen Inhalt einfügen → "Run".
--  Die Tabellen "scores" (Flappy) und "f1_stats" (Retail F1 Fiber)
--  werden NICHT angefasst.
-- =====================================================================

create table if not exists public.mofu_scores (
  id              bigint generated always as identity primary key,
  name            text    not null check (char_length(btrim(name)) between 1 and 16
                                          and name !~ '[[:cntrl:]]'),
  provision_cents integer not null check (provision_cents between 0 and 5000000),  -- max. 50.000 €
  hits            integer not null default 0 check (hits between 0 and 400),
  shots           integer not null default 0 check (shots between 0 and 400),
  created_at      timestamptz not null default now(),
  -- Plausibilität: höchstens 156,50 € (MagentaMobil M Neu inkl. AP) je Treffer
  constraint mofu_scores_plausible check (hits <= shots and provision_cents <= hits * 15650)
);

create index if not exists mofu_scores_top_idx
  on public.mofu_scores (provision_cents desc, created_at asc);

-- Row Level Security: alle dürfen lesen und neue Ergebnisse eintragen,
-- niemand darf ändern oder löschen.
alter table public.mofu_scores enable row level security;

drop policy if exists "mofu_scores lesen" on public.mofu_scores;
create policy "mofu_scores lesen" on public.mofu_scores
  for select to anon, authenticated using (true);

drop policy if exists "mofu_scores eintragen" on public.mofu_scores;
create policy "mofu_scores eintragen" on public.mofu_scores
  for insert to anon, authenticated
  with check (
    char_length(btrim(name)) between 1 and 16
    and provision_cents between 0 and 5000000
    and hits between 0 and 400
    and shots between 0 and 400
    and hits <= shots
    and provision_cents <= hits * 15650
    and created_at > now() - interval '1 minute'
  );

grant select, insert on public.mofu_scores to anon, authenticated;
revoke update, delete, truncate on public.mofu_scores from anon, authenticated;

-- Damit die API die neue Tabelle sofort kennt:
notify pgrst, 'reload schema';

-- Optional zum Prüfen:
--   select name, provision_cents / 100.0 as provision_eur, hits, shots, created_at
--   from public.mofu_scores order by provision_cents desc, created_at asc limit 15;
-- Zurücksetzen (Vorsicht, löscht alle Einträge):
--   truncate public.mofu_scores;

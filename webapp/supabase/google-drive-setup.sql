-- AnkiGen webapp - Google Drive 連結資料表
--
-- 使用方式：登入 Supabase 專案後台 -> SQL Editor -> New query，貼上執行。
-- 這張表只存「使用者授權後 Google 給的 refresh_token」，不存實際檔案。

create table if not exists public.google_drive_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  folder_id text,
  connected_at timestamptz not null default now()
);

alter table public.google_drive_connections enable row level security;

drop policy if exists "owner_full_access" on public.google_drive_connections;
create policy "owner_full_access" on public.google_drive_connections
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

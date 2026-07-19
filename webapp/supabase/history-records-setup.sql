-- AnkiGen webapp - 歷史紀錄資料表
--
-- 使用方式：登入 Supabase 專案後台 -> SQL Editor -> New query，貼上執行。
--
-- cards 是一個 JSONB 陣列，每個元素依 source 不同會有不同欄位：
--   source = 'mcq'（純文字選擇題，沒有圖片）：
--     { questionText, optionA, optionB, optionC, optionD, optionE, optionF, answer, isMultiple, notes }
--   source = 'slides-mcq' / 'slides-occlusion'（有圖片）：
--     上面的欄位之外，再加上：
--     driveFileId        -- 原始畫質圖片在 Google Drive 的檔案 ID
--     drivePreviewFileId -- 縮小過的預覽圖在 Google Drive 的檔案 ID
--   這兩個 ID 直接餵給 /api/google-drive/image/[fileId] 就能顯示圖片。
--
-- 不存 CSV 內容：下載 CSV 時直接從 cards 即時組出來，避免多存一份跟格式走鐘。

create table if not exists public.history_records (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null,
  purpose text,
  card_count integer not null default 0,
  cards jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists history_records_user_created_idx
  on public.history_records (user_id, created_at desc);

alter table public.history_records enable row level security;

drop policy if exists "owner_full_access" on public.history_records;
create policy "owner_full_access" on public.history_records
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

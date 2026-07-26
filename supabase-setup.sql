-- AnkiGen - Supabase 初始設定 SQL
--
-- 使用方式：登入 Supabase 專案後台 -> SQL Editor -> New query，
-- 把這整份貼上執行一次即可。
--
-- 前提：你已經在 Authentication -> Users 建立好自己的登入帳號
-- (email + 密碼)，之後歷史紀錄只有這個帳號能讀寫。
--
-- 忘記密碼功能（寄送重設密碼連結）需要額外設定一次：
-- Supabase 後台 -> Authentication -> URL Configuration -> Redirect URLs，
-- 把 https://anki-gen-hub.vercel.app/reset-password.html 加進白名單。
-- 這一步是免費版就有的基本設定，不需要修改 Email Templates 內容 ——
-- Supabase 內建的「Reset Password」信件本身就有連結，使用者點了之後
-- 會被導到 reset-password.html 設定新密碼（見該檔案 / reset-password.js）。

-- 1. 資料表：一筆歷史紀錄一列，cards 用 JSONB 陣列存每張卡片的結構化資料
--    （圖片本身不存在這裡，只存 Storage 的路徑字串）
create table if not exists public.history_records (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null,
  purpose text,
  card_count integer not null default 0,
  csv_filename text not null,
  csv_content text not null,
  cards jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists history_records_user_created_idx
  on public.history_records (user_id, created_at desc);

-- 2. 開啟 RLS，並且只允許資料的擁有者（自己）讀寫自己的紀錄
alter table public.history_records enable row level security;

drop policy if exists "owner_full_access" on public.history_records;
create policy "owner_full_access" on public.history_records
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. Storage：建立一個私有的 bucket 存放圖片（原始圖 + 縮圖預覽）
--    注意：insert into storage.buckets 只需要跑一次；如果你已經在
--    Storage 頁面手動建立過同名 bucket，這行可以省略或會被忽略。
insert into storage.buckets (id, name, public)
values ('history-media', 'history-media', false)
on conflict (id) do nothing;

-- 4. Storage 的 RLS：路徑規則是 {user_id}/{record_id}/{index}-{preview|original}.{ext}，
--    用路徑的第一段（user_id）比對 auth.uid()，確保只有自己能讀寫自己的檔案
drop policy if exists "owner_full_access_media" on storage.objects;
create policy "owner_full_access_media" on storage.objects
  for all
  using (bucket_id = 'history-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'history-media' and (storage.foldername(name))[1] = auth.uid()::text);

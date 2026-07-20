-- AnkiGen webapp - 幫 google_drive_connections 補上 drive_email 欄位
--
-- 存放實際連結的 Google 帳號 email，讓網站可以在頁首顯示「目前連結的是哪個 Google 帳號」。
-- 這個值是連結當下向 Google 要 email/profile 權限拿到的，舊有的連結記錄不會自動補上，
-- 需要使用者重新走一次「連結 Google Drive」才會補齊（Google 每次授權都會照最新 scope 重新詢問同意）。
-- 到 Supabase SQL Editor 貼上執行一次即可。

alter table public.google_drive_connections
  add column if not exists drive_email text;

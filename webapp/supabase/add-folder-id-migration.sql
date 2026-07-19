-- AnkiGen webapp - 幫 google_drive_connections 補上 folder_id 欄位
--
-- 你已經先前執行過 google-drive-setup.sql 建過表了，這份是給既有的表補一個新欄位用，
-- 存放「AnkiGen Hub」這個專屬資料夾在 Google Drive 上的檔案 ID，第一次上傳圖片時
-- 會自動建立並存進來，之後上傳都會重複使用同一個資料夾。
-- 到 Supabase SQL Editor 貼上執行一次即可。

alter table public.google_drive_connections
  add column if not exists folder_id text;

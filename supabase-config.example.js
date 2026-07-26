// AnkiGen - Supabase 連線設定範本
//
// 使用方式：
// 1. 複製這個檔案，改名成 supabase-config.js（跟這個檔案放在同一個資料夾）
// 2. 到你的 Supabase 專案 -> Project Settings -> API，把下面兩個值換成你自己的
// 3. supabase-config.js 已經被加進 .gitignore，不會被提交進版本控制
//
// 注意：SUPABASE_ANON_KEY 是設計上可以公開的「匿名金鑰」，真正保護資料的是
// Supabase 後台的 Row Level Security (RLS) 規則和登入帳號，不是這把金鑰本身。
// 詳細的建表 SQL 請參考 supabase-setup.sql。

window.SUPABASE_URL = 'https://your-project-ref.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-public-key';

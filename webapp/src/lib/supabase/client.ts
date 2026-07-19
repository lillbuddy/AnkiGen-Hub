import { createBrowserClient } from '@supabase/ssr'

// 給 Client Component 用的 Supabase client（在瀏覽器執行）。
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

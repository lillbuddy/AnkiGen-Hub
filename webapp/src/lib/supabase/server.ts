import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 給 Server Component / Server Function 用的 Supabase client。
// cookies() 在這個 Next.js 版本是 async function，要 await。
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 從 Server Component 呼叫 setAll 時會丟這個錯誤，
            // 只要有 proxy.ts 負責刷新 session 就可以忽略。
          }
        },
      },
    }
  )
}

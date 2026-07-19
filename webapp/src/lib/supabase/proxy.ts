import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 每個請求進來時刷新 Supabase 的登入 session（讓 cookie 裡的 token 保持有效）。
// 由專案根目錄的 src/proxy.ts 呼叫。
//
// 這裡的 try/catch 很重要：proxy 幾乎對每個路徑都會執行，如果 Supabase 的
// 環境變數設定錯誤或連線失敗導致這裡丟出例外，不能讓「刷新登入」這個附加功能
// 把整個網站（包括完全不相關的頁面）都弄成 500。寧可這次跳過刷新、讓網頁正常顯示，
// 也不要整站當機。
export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '[proxy] 找不到 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY，跳過 session 刷新。' +
        '請檢查 Vercel 專案的 Settings -> Environment Variables。'
    )
    return supabaseResponse
  }

  try {
    let response = supabaseResponse

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    // 一定要呼叫 getUser()（不是 getSession()）才會真的去跟 Supabase 驗證 token。
    await supabase.auth.getUser()

    return response
  } catch (error) {
    console.error('[proxy] 刷新 Supabase session 時發生錯誤，跳過刷新：', error)
    return supabaseResponse
  }
}

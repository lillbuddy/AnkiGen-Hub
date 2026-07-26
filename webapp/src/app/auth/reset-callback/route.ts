import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 忘記密碼信件裡的連結專用的 callback（跟 /auth/callback 分開、獨立一條路徑，
// 不共用、也不能帶查詢參數）。原因見 /auth/callback/route.ts 的註解：Supabase
// 的 Redirect URLs 白名單是精確字串比對，一旦網址帶了查詢參數（例如原本想用
// /auth/callback?next=/reset-password 這種寫法）就會跟白名單裡登記的網址對
// 不起來，Supabase 會靜默改用 Site URL 退回，使用者只會發現跳錯地方、
// 密碼也沒真的被改到，不會有任何錯誤訊息。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/reset-password`)
    }
  }

  // 沒有 code，或換 session 失敗（連結過期、已經用過一次...）。
  return NextResponse.redirect(`${origin}/reset-password?error=link_failed`)
}

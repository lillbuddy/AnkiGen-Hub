import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 使用者在註冊確認信裡點的連結，Supabase 驗證完 token 後會導回這裡（帶著
// ?code=...），這裡要把 code 換成真正的登入 session，再導去登入頁。
// 一定要用 signUp() 的 emailRedirectTo 指到這條路徑，Email 裡的連結才會
// 對到「使用者實際註冊的那個網域」，而不是 Supabase 專案設定裡固定寫死的
// Site URL（不然本機開發時設定的 localhost 會被寄進所有使用者的信裡）。
//
// 這條路徑不能帶任何查詢參數（例如 ?next=...）：Supabase 的 Redirect URLs
// 白名單是精確字串比對，帶了查詢參數就對不上白名單裡登記的網址，會被
// 靜默改用後台的 Site URL 退回（人不會看到錯誤訊息，只會發現跳錯地方）。
// 忘記密碼流程因此另外用 /auth/reset-callback，不跟這裡共用。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/login?confirmed=1`)
    }
  }

  // 沒有 code，或換 session 失敗（連結過期、已經用過一次...）。
  return NextResponse.redirect(`${origin}/login?error=confirm_failed`)
}

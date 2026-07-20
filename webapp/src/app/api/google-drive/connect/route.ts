import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildGoogleAuthUrl } from '@/lib/google-drive/oauth'

const STATE_COOKIE = 'google_drive_oauth_state'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const state = crypto.randomUUID()
  const redirectUri = new URL('/api/google-drive/callback', request.url).toString()

  // 讓使用者選擇：沿用登入 AnkiGen Hub 用的 email 當作建議帳號（?reuseLogin=1），
  // 或是強制顯示 Google 的帳號選擇畫面，方便換成別的 Google 帳號（?chooseAccount=1）。
  const reuseLogin = request.nextUrl.searchParams.get('reuseLogin') === '1'
  const chooseAccount = request.nextUrl.searchParams.get('chooseAccount') === '1'

  const authUrl = buildGoogleAuthUrl(redirectUri, state, {
    loginHint: reuseLogin && user.email ? user.email : undefined,
    forceAccountChooser: chooseAccount,
  })

  const response = NextResponse.redirect(authUrl)
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    // Secure cookie 在非 HTTPS（例如本機 http://localhost）下瀏覽器不會存也不會送出，
    // 所以要跟著目前請求實際的協定走，不能寫死 true，否則本機測試 state 永遠對不起來。
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 分鐘內要完成授權
    path: '/',
  })
  return response
}

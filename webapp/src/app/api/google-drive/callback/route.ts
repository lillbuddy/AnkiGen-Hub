import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens } from '@/lib/google-drive/oauth'

const STATE_COOKIE = 'google_drive_oauth_state'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const googleError = url.searchParams.get('error')

  const homeUrl = new URL('/', request.url)

  if (googleError) {
    homeUrl.searchParams.set('drive_error', googleError)
    return NextResponse.redirect(homeUrl)
  }

  const expectedState = request.cookies.get(STATE_COOKIE)?.value
  if (!code || !state || !expectedState || state !== expectedState) {
    homeUrl.searchParams.set('drive_error', 'invalid_state')
    return NextResponse.redirect(homeUrl)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const redirectUri = new URL('/api/google-drive/callback', request.url).toString()
    const tokens = await exchangeCodeForTokens(code, redirectUri)

    if (!tokens.refresh_token) {
      // 理論上帶了 prompt=consent 一定會拿到，這裡是保險，方便未來排查問題。
      console.error('[google-drive callback] Google 沒有回傳 refresh_token', tokens)
      homeUrl.searchParams.set('drive_error', 'no_refresh_token')
      return NextResponse.redirect(homeUrl)
    }

    const { error: dbError } = await supabase.from('google_drive_connections').upsert({
      user_id: user.id,
      refresh_token: tokens.refresh_token,
      connected_at: new Date().toISOString(),
    })

    if (dbError) {
      console.error('[google-drive callback] 寫入 Supabase 失敗', dbError)
      homeUrl.searchParams.set('drive_error', 'db_error')
      return NextResponse.redirect(homeUrl)
    }

    homeUrl.searchParams.set('drive_connected', '1')
    const response = NextResponse.redirect(homeUrl)
    response.cookies.delete(STATE_COOKIE)
    return response
  } catch (error) {
    console.error('[google-drive callback] 交換 token 失敗', error)
    homeUrl.searchParams.set('drive_error', 'token_exchange_failed')
    return NextResponse.redirect(homeUrl)
  }
}

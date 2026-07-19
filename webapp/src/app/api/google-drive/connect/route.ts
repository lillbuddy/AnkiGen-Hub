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

  const response = NextResponse.redirect(buildGoogleAuthUrl(redirectUri, state))
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 分鐘內要完成授權
    path: '/',
  })
  return response
}

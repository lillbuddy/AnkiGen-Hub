// Google OAuth（drive.file scope）共用邏輯。
// 注意：GOOGLE_CLIENT_SECRET 一定只能在伺服器端程式碼使用（沒有 NEXT_PUBLIC_ 前綴），
// 絕對不能傳到瀏覽器端。

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'
// email scope 只是為了在頁首顯示「目前連結的是哪個 Google 帳號」，不會拿來做其他用途。
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email'

export function buildGoogleAuthUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline', // 沒有這個拿不到 refresh_token
    prompt: 'consent', // 沒有這個，非第一次授權時 Google 不會再給 refresh_token
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

// 用剛拿到的 access_token 問 Google「這是哪個帳號」，只在連結當下呼叫一次，
// 拿到的 email 存進 google_drive_connections，之後純粹用來顯示，不影響 Drive 讀寫本身。
export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null
    const data = (await response.json()) as { email?: string }
    return data.email ?? null
  } catch {
    return null
  }
}

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  token_type: string
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Google token exchange 失敗（${response.status}）：${body}`)
  }

  return (await response.json()) as GoogleTokenResponse
}

// 用存起來的 refresh_token 換一個新的短效 access_token（每次真的要呼叫 Drive API 前都要做這一步）。
export async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Google access_token 刷新失敗（${response.status}）：${body}`)
  }

  return (await response.json()) as GoogleTokenResponse
}

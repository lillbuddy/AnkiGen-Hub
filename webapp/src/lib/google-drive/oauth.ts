// Google OAuth（drive.file scope）共用邏輯。
// 注意：GOOGLE_CLIENT_SECRET 一定只能在伺服器端程式碼使用（沒有 NEXT_PUBLIC_ 前綴），
// 絕對不能傳到瀏覽器端。

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export function buildGoogleAuthUrl(redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    access_type: 'offline', // 沒有這個拿不到 refresh_token
    prompt: 'consent', // 沒有這個，非第一次授權時 Google 不會再給 refresh_token
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
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

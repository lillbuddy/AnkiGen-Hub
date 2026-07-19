import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from './sign-out-button'

const DRIVE_ERROR_MESSAGES: Record<string, string> = {
  access_denied: '你取消了 Google 的授權。',
  invalid_state: '授權驗證失敗，請重新再試一次。',
  no_refresh_token: 'Google 沒有給我們長期授權，請重新再試一次。',
  db_error: '儲存授權結果時發生錯誤。',
  token_exchange_failed: '跟 Google 交換 token 時發生錯誤。',
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ drive_connected?: string; drive_error?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let driveConnected = false
  if (user) {
    const { data } = await supabase
      .from('google_drive_connections')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    driveConnected = !!data
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">AnkiGen Hub</h1>
      {user ? (
        <>
          <p>
            已登入：<span className="font-mono">{user.email}</span>
          </p>

          {params.drive_connected && (
            <p className="text-sm text-green-700">已成功連結 Google Drive！</p>
          )}
          {params.drive_error && (
            <p className="text-sm text-red-600">
              連結 Google Drive 失敗：
              {DRIVE_ERROR_MESSAGES[params.drive_error] ?? params.drive_error}
            </p>
          )}

          {driveConnected ? (
            <p className="text-sm text-gray-600">已連結 Google Drive</p>
          ) : (
            <a
              href="/api/google-drive/connect"
              className="rounded bg-green-600 px-3 py-2 text-white"
            >
              連結 Google Drive
            </a>
          )}

          <SignOutButton />
        </>
      ) : (
        <>
          <p>尚未登入</p>
          <Link href="/login" className="rounded bg-blue-600 px-3 py-2 text-white">
            前往登入
          </Link>
        </>
      )}
    </main>
  )
}

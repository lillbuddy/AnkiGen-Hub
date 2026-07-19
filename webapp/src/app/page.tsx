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
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center p-6">
      <div className="card-panel flex w-full flex-col items-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold text-text-primary">AnkiGen Hub</h1>
        {user ? (
          <>
            <p className="text-sm text-text-secondary">
              已登入：<span className="font-mono">{user.email}</span>
            </p>

            {params.drive_connected && (
              <p className="text-sm text-success">已成功連結 Google Drive！</p>
            )}
            {params.drive_error && (
              <p className="text-sm text-danger">
                連結 Google Drive 失敗：
                {DRIVE_ERROR_MESSAGES[params.drive_error] ?? params.drive_error}
              </p>
            )}

            <Link href="/tools/mcq" className="btn btn-primary w-full">
              文字選擇題產生器
            </Link>
            <Link href="/history" className="text-sm text-primary underline">
              歷史紀錄
            </Link>

            {driveConnected ? (
              <>
                <p className="text-sm text-text-secondary">已連結 Google Drive</p>
                <a
                  href="/api/google-drive/test"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline"
                >
                  測試 Google Drive 讀寫
                </a>
                <Link href="/tools/image-mcq" className="btn btn-primary w-full">
                  圖片選擇題工具
                </Link>
                <Link href="/tools/image-occlusion" className="btn btn-primary w-full">
                  Image Occlusion 工具
                </Link>
              </>
            ) : (
              <a href="/api/google-drive/connect" className="btn btn-success w-full">
                連結 Google Drive
              </a>
            )}

            <SignOutButton />
          </>
        ) : (
          <>
            <p className="text-sm text-text-secondary">尚未登入</p>
            <Link href="/login" className="btn btn-primary w-full">
              前往登入
            </Link>
          </>
        )}
      </div>
    </main>
  )
}

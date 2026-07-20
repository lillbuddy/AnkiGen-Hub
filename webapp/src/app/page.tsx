import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center p-6">
        <div className="card-panel flex w-full flex-col items-center gap-4 p-8 text-center">
          <h1 className="font-display text-xl font-bold text-text-primary">AnkiGen Hub</h1>
          <p className="text-sm text-text-secondary">尚未登入</p>
          <Link href="/login" className="btn btn-primary w-full">
            前往登入
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <div className="mb-10 text-center">
        <h1 className="mb-3 font-display text-3xl font-extrabold tracking-tight text-text-primary">
          把讀書筆記與圖片，變成 Anki 卡片
        </h1>
        <p className="text-sm text-text-secondary">選擇下面的工具開始使用。</p>
      </div>

      {params.drive_connected && (
        <p className="mb-4 text-center text-sm text-success">已成功連結 Google Drive！</p>
      )}
      {params.drive_error && (
        <p className="mb-4 text-center text-sm text-danger">
          連結 Google Drive 失敗：{DRIVE_ERROR_MESSAGES[params.drive_error] ?? params.drive_error}
        </p>
      )}

      <div className="mx-auto mb-10 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2">
        <Link href="/tools/mcq" className="tool-card">
          <div className="tool-icon">📝</div>
          <h2 className="mb-2 font-display text-lg font-bold text-text-primary">文字選擇題產生器</h2>
          <p className="flex-1 text-sm text-text-secondary">
            貼上文字內容，用 AI 解析成題目、選項、答案，即時預覽 Anki 卡片效果，一鍵匯出可直接匯入 Anki 的萬用選擇題卡片。
          </p>
          <span className="tool-cta">開始製作 →</span>
        </Link>

        {driveConnected ? (
          <Link href="/tools/slides" className="tool-card">
            <div className="tool-icon">🖼️</div>
            <h2 className="mb-2 font-display text-lg font-bold text-text-primary">圖片標記工具</h2>
            <p className="flex-1 text-sm text-text-secondary">
              選取本機圖片並重新命名，接著選擇匯出成選擇題（AI 還能幫你產生誘答性的干擾選項）或 Image Occlusion，存進你自己的
              Google Drive。
            </p>
            <span className="tool-cta">開始標記 →</span>
          </Link>
        ) : (
          <a href="/api/google-drive/connect" className="tool-card">
            <div className="tool-icon">🔗</div>
            <h2 className="mb-2 font-display text-lg font-bold text-text-primary">連結 Google Drive</h2>
            <p className="flex-1 text-sm text-text-secondary">
              圖片選擇題和 Image Occlusion 這兩個工具需要把圖片存進你自己的 Google Drive，先連結帳號才能使用。
            </p>
            <span className="tool-cta">前往連結 →</span>
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
        <span className="text-text-secondary">
          已登入：<span className="font-mono">{user.email}</span>
        </span>
      </div>
    </main>
  )
}

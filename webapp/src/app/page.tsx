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

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
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

      <div className="mx-auto mb-6 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/tools/mcq" className="tool-card">
          <div className="tool-icon">📝</div>
          <h2 className="mb-2 font-display text-lg font-bold text-text-primary">文字選擇題產生器</h2>
          <p className="flex-1 text-sm text-text-secondary">
            貼上文字內容，用 AI 解析成題目、選項、答案，即時預覽 Anki 卡片效果，一鍵匯出可直接匯入 Anki 的萬用選擇題卡片。
          </p>
          <span className="tool-cta">開始製作 →</span>
        </Link>

        <Link href="/tools/slides" className="tool-card">
          <div className="tool-icon">🖼️</div>
          <h2 className="mb-2 font-display text-lg font-bold text-text-primary">圖片標記工具</h2>
          <p className="flex-1 text-sm text-text-secondary">
            選取本機圖片並重新命名，接著選擇匯出成選擇題（AI 還能幫你產生誘答性的干擾選項）或 Image
            Occlusion，下載 CSV 或直接存入 Anki。
          </p>
          <span className="tool-cta">開始標記 →</span>
        </Link>

        <Link href="/tools/cloze" className="tool-card">
          <div className="tool-icon">🔤</div>
          <h2 className="mb-2 font-display text-lg font-bold text-text-primary">克漏字卡片產生器</h2>
          <p className="flex-1 text-sm text-text-secondary">
            輸入想背的單字清單，AI 會針對每個單字生成一句例句並自動挖空，做成 Anki
            克漏字卡片，特別適合背單字的使用者。
          </p>
          <span className="tool-cta">開始背單字 →</span>
        </Link>
      </div>

      {user && !driveConnected && (
        <div className="mx-auto mb-10 max-w-2xl">
          <div className="drive-connect-banner">
            <div className="drive-connect-banner-text">
              🔗 想把卡組存進「歷史紀錄」方便之後查找嗎？連結 Google Drive 後，圖片標記工具就能把圖片存到你自己的帳號裡。
            </div>
            <div className="drive-connect-banner-actions">
              <a href="/api/google-drive/connect?reuseLogin=1" className="btn btn-primary btn-sm">
                使用 {user.email} 連結
              </a>
              <a href="/api/google-drive/connect?chooseAccount=1" className="btn btn-secondary btn-sm">
                使用其他 Google 帳號
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
        {user ? (
          <span className="text-text-secondary">
            已登入：<span className="font-mono">{user.email}</span>
          </span>
        ) : (
          <div className="card-panel flex w-full flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-text-secondary">
              免登入即可使用上方工具產生卡片、下載 CSV 或直接存入 Anki。想把卡組存進「歷史紀錄」方便之後查找、或串接
              Google Drive 保存圖片，才需要登入。
            </p>
            <div className="flex gap-2">
              <Link href="/login" className="btn btn-primary btn-sm">
                登入
              </Link>
              <Link href="/signup" className="btn btn-secondary btn-sm">
                註冊帳號
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

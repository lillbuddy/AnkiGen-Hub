import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken } from '@/lib/google-drive/oauth'
import { createTestFile, createTestImage, listAppFiles } from '@/lib/google-drive/drive-client'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderResultPage({
  testFile,
  testImage,
  fileCount,
}: {
  testFile: { name: string; webViewLink?: string }
  testImage: { id: string; name: string }
  fileCount: number
}) {
  return `<!doctype html>
<html lang="zh-TW">
<head><meta charset="utf-8"><title>Google Drive 讀寫測試</title></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 40px auto; text-align: center;">
  <h1>Google Drive 讀寫測試成功</h1>
  <p>文字測試檔案：${escapeHtml(testFile.name)}
    ${testFile.webViewLink ? `(<a href="${escapeHtml(testFile.webViewLink)}" target="_blank">在 Drive 開啟</a>)` : ''}
  </p>
  <p>drive.file scope 底下目前看得到 ${fileCount} 個檔案。</p>
  <hr />
  <h2>圖片代理測試</h2>
  <p>下面這張圖是透過 <code>/api/google-drive/image/${escapeHtml(testImage.id)}</code> 從 Google Drive 讀出來顯示的，
  不是直接連到 Google 的網址：</p>
  <img src="/api/google-drive/image/${escapeHtml(testImage.id)}" alt="測試圖片" width="100" height="100"
    style="border: 1px solid #ccc; image-rendering: pixelated;" />
  <p>如果上面有看到一個小紅色方塊，代表整條「Drive 圖片 -> 我們的伺服器 -> 網頁 img」的路徑是通的。</p>
</body>
</html>`
}

// 手動測試用的路由：驗證存起來的 refresh_token 真的能拿來讀寫使用者的 Google Drive，
// 並且驗證圖片可以透過 /api/google-drive/image/[fileId] 顯示在網頁上。
// 登入 + 已連結 Google Drive 後直接用瀏覽器開這個網址即可看到結果頁面。
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '尚未登入' }, { status: 401 })
  }

  const { data: connection, error: connectionError } = await supabase
    .from('google_drive_connections')
    .select('refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()

  if (connectionError || !connection) {
    return NextResponse.json({ error: '尚未連結 Google Drive' }, { status: 400 })
  }

  try {
    const { access_token } = await refreshAccessToken(connection.refresh_token)

    const testFile = await createTestFile(
      access_token,
      `這是 AnkiGen Hub 在 ${new Date().toISOString()} 寫入的測試內容。`
    )
    const testImage = await createTestImage(access_token)
    const files = await listAppFiles(access_token)

    const html = renderResultPage({ testFile, testImage, fileCount: files.length })
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (error) {
    console.error('[google-drive test] 失敗', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

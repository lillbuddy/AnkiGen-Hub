import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken } from '@/lib/google-drive/oauth'
import { createTestFile, listAppFiles } from '@/lib/google-drive/drive-client'

// 手動測試用的路由：驗證存起來的 refresh_token 真的能拿來讀寫使用者的 Google Drive。
// 登入 + 已連結 Google Drive 後直接用瀏覽器開這個網址即可看到結果 JSON。
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
    const files = await listAppFiles(access_token)

    return NextResponse.json({ ok: true, testFile, files })
  } catch (error) {
    console.error('[google-drive test] 失敗', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

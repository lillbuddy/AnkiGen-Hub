import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken } from '@/lib/google-drive/oauth'

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files'

// 把 Google Drive 的圖片轉發給瀏覽器，讓 <img src="/api/google-drive/image/xxx"> 能直接顯示。
//
// 授權邏輯：一定要用「目前登入的這個使用者自己的」access_token 去跟 Google 要這個檔案。
// Google Drive 本身就會替我們把關——如果這個 fileId 不屬於這個使用者（drive.file scope
// 只認得到這個 App 幫這個帳號建立過的檔案），Google 會回 404，我們不需要另外自己存一份
// 「哪個 fileId 屬於哪個使用者」的對照表來做權限檢查。
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '尚未登入' }, { status: 401 })
  }

  const { data: connection } = await supabase
    .from('google_drive_connections')
    .select('refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!connection) {
    return NextResponse.json({ error: '尚未連結 Google Drive' }, { status: 400 })
  }

  try {
    const { access_token } = await refreshAccessToken(connection.refresh_token)

    const driveResponse = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!driveResponse.ok || !driveResponse.body) {
      return NextResponse.json(
        { error: `無法取得圖片（${driveResponse.status}）` },
        { status: driveResponse.status === 404 ? 404 : 502 }
      )
    }

    const contentType = driveResponse.headers.get('content-type') ?? 'application/octet-stream'

    return new NextResponse(driveResponse.body, {
      headers: {
        'Content-Type': contentType,
        // private：只給這個使用者自己的瀏覽器快取，不能被中間的共用快取（CDN）存起來
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[google-drive image]', error)
    return NextResponse.json({ error: '讀取圖片時發生錯誤' }, { status: 500 })
  }
}

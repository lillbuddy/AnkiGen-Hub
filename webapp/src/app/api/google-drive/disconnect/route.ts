import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revokeGoogleToken } from '@/lib/google-drive/oauth'

// 解除連結 Google Drive：撤銷 Google 那邊的授權（盡力而為），並刪除本地的連結紀錄。
// 不會動到已經上傳到使用者自己 Google Drive 裡的檔案，那些檔案本來就在使用者自己的帳號下。
export async function POST() {
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

  if (connection?.refresh_token) {
    await revokeGoogleToken(connection.refresh_token)
  }

  const { error: dbError } = await supabase
    .from('google_drive_connections')
    .delete()
    .eq('user_id', user.id)

  if (dbError) {
    console.error('[google-drive disconnect] 刪除連結紀錄失敗', dbError)
    return NextResponse.json({ error: '解除連結失敗，請稍後再試' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

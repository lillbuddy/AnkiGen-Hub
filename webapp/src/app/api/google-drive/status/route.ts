import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 給頁首用的輕量查詢：目前有沒有連結 Google Drive、連結的是哪個帳號。
// 不會碰任何 access_token/refresh_token，純粹讀 email 顯示用。
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ connected: false, email: null })
  }

  const { data } = await supabase
    .from('google_drive_connections')
    .select('drive_email')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ connected: !!data, email: data?.drive_email ?? null })
}

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken } from '@/lib/google-drive/oauth'
import { deleteFile } from '@/lib/google-drive/drive-client'
import type { HistoryRecord } from '@/lib/history-types'

// 刪除一筆歷史紀錄：連同 Drive 上對應的原始圖+縮圖一起刪除（best-effort，
// Drive 那邊刪除失敗不擋住資料庫這筆紀錄被刪除）。
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '尚未登入' }, { status: 401 })
  }

  const { data: record } = await supabase
    .from('history_records')
    .select('id, cards')
    .eq('id', id)
    .maybeSingle<Pick<HistoryRecord, 'id' | 'cards'>>()

  if (!record) {
    return NextResponse.json({ error: '找不到這筆紀錄' }, { status: 404 })
  }

  const { data: connection } = await supabase
    .from('google_drive_connections')
    .select('refresh_token')
    .eq('user_id', user.id)
    .maybeSingle()

  if (connection && record.cards?.length > 0) {
    try {
      const { access_token } = await refreshAccessToken(connection.refresh_token)
      await Promise.all(
        record.cards.flatMap((card) => [
          deleteFile(access_token, card.driveFileId).catch((e) =>
            console.error('[history delete] 刪除原始圖失敗', e)
          ),
          deleteFile(access_token, card.drivePreviewFileId).catch((e) =>
            console.error('[history delete] 刪除縮圖失敗', e)
          ),
        ])
      )
    } catch (error) {
      console.error('[history delete] 刪除 Drive 檔案時發生錯誤，繼續刪除資料庫紀錄', error)
    }
  }

  const { error: deleteError } = await supabase.from('history_records').delete().eq('id', id)

  if (deleteError) {
    console.error('[history delete] 刪除資料庫紀錄失敗', deleteError)
    return NextResponse.json({ error: '刪除歷史紀錄失敗' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

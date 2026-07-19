import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken } from '@/lib/google-drive/oauth'
import { deleteFile } from '@/lib/google-drive/drive-client'
import type { HistoryRecord, SlidesMcqCard } from '@/lib/history-types'

function isSlidesCard(card: HistoryRecord['cards'][number]): card is SlidesMcqCard {
  return typeof (card as SlidesMcqCard).driveFileId === 'string'
}

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
      // 抽屜功能會讓好幾筆紀錄共用同一組 Drive 檔案 ID（沿用舊圖片、不重新上傳），
      // 所以刪除前一定要先確認這個檔案有沒有被「其他」紀錄用著，還在用的話絕對不能刪。
      const { data: otherRecords } = await supabase
        .from('history_records')
        .select('cards')
        .eq('user_id', user.id)
        .neq('id', id)
        .returns<Pick<HistoryRecord, 'cards'>[]>()

      const stillInUse = new Set<string>()
      for (const other of otherRecords ?? []) {
        for (const card of other.cards ?? []) {
          if (isSlidesCard(card)) {
            stillInUse.add(card.driveFileId)
            stillInUse.add(card.drivePreviewFileId)
          }
        }
      }

      const { access_token } = await refreshAccessToken(connection.refresh_token)
      await Promise.all(
        record.cards.filter(isSlidesCard).flatMap((card) => {
          const tasks: Promise<void>[] = []
          if (!stillInUse.has(card.driveFileId)) {
            tasks.push(
              deleteFile(access_token, card.driveFileId).catch((e) =>
                console.error('[history delete] 刪除原始圖失敗', e)
              )
            )
          }
          if (!stillInUse.has(card.drivePreviewFileId)) {
            tasks.push(
              deleteFile(access_token, card.drivePreviewFileId).catch((e) =>
                console.error('[history delete] 刪除縮圖失敗', e)
              )
            )
          }
          return tasks
        })
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

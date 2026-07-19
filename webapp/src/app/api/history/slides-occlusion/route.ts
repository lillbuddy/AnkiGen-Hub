import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshAccessToken } from '@/lib/google-drive/oauth'
import { uploadFile } from '@/lib/google-drive/drive-client'
import { getOrCreateAppFolderId } from '@/lib/google-drive/app-folder'

interface CardMeta {
  filename: string
  notes: string
}

function getExtension(filename: string) {
  const dot = filename.lastIndexOf('.')
  return dot !== -1 && dot < filename.length - 1 ? filename.slice(dot + 1) : 'bin'
}

// 收「Image Occlusion」這個工具存入歷史紀錄的請求：把每張圖的原始檔+預覽圖上傳到
// 使用者的 Google Drive，再把整批卡片的資料存進 history_records。
// 沒有題目/選項/答案，只有圖片和備註——實際的遮蓋框線要在 Anki 裡手動畫。
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '尚未登入' }, { status: 401 })
  }

  const { data: connection, error: connectionError } = await supabase
    .from('google_drive_connections')
    .select('refresh_token, folder_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (connectionError) {
    console.error('[history slides-occlusion] 查詢 google_drive_connections 失敗', connectionError)
    return NextResponse.json(
      { error: `查詢 Google Drive 連結狀態失敗：${connectionError.message}` },
      { status: 500 }
    )
  }

  if (!connection) {
    return NextResponse.json({ error: '尚未連結 Google Drive' }, { status: 400 })
  }

  const formData = await request.formData()
  const purpose = String(formData.get('purpose') ?? '')
  const metaRaw = formData.get('meta')

  if (typeof metaRaw !== 'string') {
    return NextResponse.json({ error: '缺少卡片資料' }, { status: 400 })
  }

  let metaList: CardMeta[]
  try {
    metaList = JSON.parse(metaRaw)
  } catch {
    return NextResponse.json({ error: '卡片資料格式錯誤' }, { status: 400 })
  }

  if (!Array.isArray(metaList) || metaList.length === 0) {
    return NextResponse.json({ error: '至少要有一張卡片' }, { status: 400 })
  }

  try {
    const { access_token } = await refreshAccessToken(connection.refresh_token)
    const folderId = await getOrCreateAppFolderId(
      supabase,
      user.id,
      access_token,
      connection.folder_id
    )

    const cards = await Promise.all(
      metaList.map(async (meta, i) => {
        const original = formData.get(`original_${i}`)
        const preview = formData.get(`preview_${i}`)

        if (!(original instanceof File) || !(preview instanceof File)) {
          throw new Error(`第 ${i + 1} 張卡片缺少圖片檔案`)
        }

        const originalBytes = Buffer.from(await original.arrayBuffer())
        const previewBytes = Buffer.from(await preview.arrayBuffer())

        const [originalUploaded, previewUploaded] = await Promise.all([
          uploadFile(
            access_token,
            `ankigen-${Date.now()}-${i}-original.${getExtension(meta.filename)}`,
            original.type || 'application/octet-stream',
            originalBytes,
            folderId
          ),
          uploadFile(
            access_token,
            `ankigen-${Date.now()}-${i}-preview.jpg`,
            'image/jpeg',
            previewBytes,
            folderId
          ),
        ])

        return {
          filename: meta.filename,
          driveFileId: originalUploaded.id,
          drivePreviewFileId: previewUploaded.id,
          notes: meta.notes,
        }
      })
    )

    const { data: inserted, error: dbError } = await supabase
      .from('history_records')
      .insert({
        id: crypto.randomUUID(),
        user_id: user.id,
        source: 'slides-occlusion',
        purpose,
        card_count: cards.length,
        cards,
      })
      .select('id')
      .single()

    if (dbError) {
      console.error('[history slides-occlusion] 寫入 Supabase 失敗', dbError)
      return NextResponse.json({ error: '存入歷史紀錄失敗' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, recordId: inserted.id })
  } catch (error) {
    console.error('[history slides-occlusion] 失敗', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

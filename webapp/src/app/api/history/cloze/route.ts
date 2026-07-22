import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ClozeCard } from '@/lib/history-types'

// 收「克漏字卡片」這個工具存入歷史紀錄的請求。純文字，沒有圖片，
// 不需要碰 Google Drive，直接把卡片資料存進 history_records。
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '尚未登入' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const purpose = typeof body?.purpose === 'string' ? body.purpose : ''
  const cards = body?.cards as ClozeCard[] | undefined

  if (!Array.isArray(cards) || cards.length === 0) {
    return NextResponse.json({ error: '至少要有一張卡片' }, { status: 400 })
  }

  const { data: inserted, error: dbError } = await supabase
    .from('history_records')
    .insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      source: 'cloze',
      purpose,
      card_count: cards.length,
      cards,
    })
    .select('id')
    .single()

  if (dbError) {
    console.error('[history cloze] 寫入 Supabase 失敗', dbError)
    return NextResponse.json({ error: '存入歷史紀錄失敗' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, recordId: inserted.id })
}

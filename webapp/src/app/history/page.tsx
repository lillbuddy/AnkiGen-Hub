import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { type HistoryRecord } from '@/lib/history-types'
import HistoryLayout from './history-layout'

export default async function HistoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl p-6 text-center">
        <p>請先登入才能查看歷史紀錄。</p>
        <Link href="/login" className="text-primary underline">
          前往登入
        </Link>
      </main>
    )
  }

  const { data: records } = await supabase
    .from('history_records')
    .select('id, source, purpose, card_count, cards, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .returns<HistoryRecord[]>()

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-6">
      <h1 className="mb-4 text-xl font-semibold">歷史紀錄</h1>
      <HistoryLayout records={records ?? []} />
    </main>
  )
}

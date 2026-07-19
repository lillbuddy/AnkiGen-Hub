import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SOURCE_LABELS, type HistoryRecord, type SlidesMcqCard } from '@/lib/history-types'
import HistoryCardItem from './history-card-item'
import McqCardItem from './mcq-card-item'
import DownloadCsvButton from '../download-csv-button'

function formatDate(isoString: string) {
  const d = new Date(isoString)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl p-6 text-center">
        <p>請先登入才能查看這筆紀錄。</p>
      </main>
    )
  }

  const { data: record } = await supabase
    .from('history_records')
    .select('id, source, purpose, card_count, cards, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle<HistoryRecord>()

  if (!record) {
    return (
      <main className="mx-auto max-w-2xl p-6 text-center">
        <p>找不到這筆歷史紀錄，可能已經被刪除了。</p>
        <Link href="/history" className="text-blue-600 underline">
          回歷史紀錄列表
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {SOURCE_LABELS[record.source] ?? record.source}
        </h1>
        <div className="flex items-center gap-3">
          <DownloadCsvButton source={record.source} cards={record.cards} />
          <Link href="/history" className="text-sm text-blue-600 underline">
            回歷史紀錄列表
          </Link>
        </div>
      </div>
      <div className="mb-4 text-sm text-gray-500">
        {formatDate(record.created_at)} ・ {record.purpose?.trim() || '（無備註）'} ・{' '}
        {record.card_count} 張卡片
      </div>

      <div className="flex flex-col gap-3">
        {record.source === 'mcq'
          ? record.cards.map((card, index) => <McqCardItem key={index} card={card} />)
          : (record.cards as SlidesMcqCard[]).map((card, index) => (
              <HistoryCardItem key={index} card={card} recordId={record.id} cardIndex={index} />
            ))}
      </div>
    </main>
  )
}

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SOURCE_LABELS, type HistoryRecord } from '@/lib/history-types'
import DeleteHistoryButton from './delete-history-button'
import DownloadCsvButton from './download-csv-button'

function formatDate(isoString: string) {
  const d = new Date(isoString)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">歷史紀錄</h1>
        <Link href="/" className="text-sm text-primary underline">
          回首頁
        </Link>
      </div>

      {(!records || records.length === 0) && (
        <p className="text-sm text-text-secondary">目前還沒有任何歷史紀錄。</p>
      )}

      <div className="flex flex-col gap-3">
        {records?.map((record) => (
          <div
            key={record.id}
            className="flex items-center justify-between card-panel p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                  {SOURCE_LABELS[record.source] ?? record.source}
                </span>
                <span className="text-xs text-text-secondary">{formatDate(record.created_at)}</span>
              </div>
              <div className="mt-1 text-sm">{record.purpose?.trim() || '（無備註）'}</div>
              <div className="text-xs text-text-secondary">{record.card_count} 張卡片</div>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/history/${record.id}`}
                className="btn btn-secondary btn-sm"
              >
                查看
              </Link>
              <DownloadCsvButton source={record.source} cards={record.cards} />
              <DeleteHistoryButton recordId={record.id} />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

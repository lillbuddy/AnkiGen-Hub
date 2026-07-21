'use client'

import { useState } from 'react'
import {
  SOURCE_LABELS,
  type HistoryRecord,
  type McqCard,
  type OcclusionCard,
  type SlidesMcqCard,
} from '@/lib/history-types'
import { fetchImageAsBase64, type AnkiCardInput } from '@/lib/anki-connect'
import DeleteHistoryButton from './delete-history-button'
import DownloadCsvButton from './download-csv-button'
import SaveToAnkiButton from '@/components/save-to-anki-button'
import McqCardItem from './mcq-card-item'
import HistoryCardItem from './history-card-item'
import OcclusionCardItem from './occlusion-card-item'

function formatDate(isoString: string) {
  const d = new Date(isoString)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 列表在左、內容在右的主從式排版：點選左側任一筆紀錄，右側直接顯示該筆卡片內容
// （圖片、題目等），不用整頁跳轉到 /history/[id]。刪除紀錄後 selectedId 若剛好
// 指向被刪除的那筆，就自動退回目前列表的第一筆，避免畫面卡在已經不存在的紀錄上。
export default function HistoryLayout({ records }: { records: HistoryRecord[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(records[0]?.id ?? null)
  const selected = records.find((r) => r.id === selectedId) ?? records[0] ?? null

  if (records.length === 0) {
    return <p className="text-sm text-text-secondary">目前還沒有任何歷史紀錄。</p>
  }

  // 圖片卡的原始圖片還在 Google Drive 上，要透過我們自己的同源 proxy route 抓
  // bytes（沒有 CORS 問題），轉成 base64 才能交給 AnkiConnect；文字卡不需要圖片。
  async function getAnkiCardsForSelected(): Promise<AnkiCardInput[]> {
    if (!selected) return []

    if (selected.source === 'mcq') {
      return (selected.cards as McqCard[]).map((card) => ({ ...card }))
    }

    if (selected.source === 'slides-mcq') {
      return Promise.all(
        (selected.cards as SlidesMcqCard[]).map(async (card) => ({
          ...card,
          image: {
            filename: card.filename,
            base64: await fetchImageAsBase64(`/api/google-drive/image/${card.driveFileId}`),
          },
        }))
      )
    }

    return []
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="flex w-full flex-col gap-2 md:w-72 md:flex-shrink-0">
        {records.map((record) => (
          <button
            key={record.id}
            onClick={() => setSelectedId(record.id)}
            className={`history-list-item ${selected?.id === record.id ? 'history-list-item-active' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                {SOURCE_LABELS[record.source] ?? record.source}
              </span>
              <span className="text-xs text-text-secondary">{formatDate(record.created_at)}</span>
            </div>
            <div className="mt-1 text-sm">{record.purpose?.trim() || '（無備註）'}</div>
            <div className="text-xs text-text-secondary">{record.card_count} 張卡片</div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {SOURCE_LABELS[selected.source] ?? selected.source}
              </h2>
              <div className="text-sm text-text-secondary">
                {formatDate(selected.created_at)} ・ {selected.purpose?.trim() || '（無備註）'} ・{' '}
                {selected.card_count} 張卡片
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DownloadCsvButton source={selected.source} cards={selected.cards} />
              {(selected.source === 'mcq' || selected.source === 'slides-mcq') && (
                <SaveToAnkiButton
                  getCards={getAnkiCardsForSelected}
                  defaultDeckName={selected.purpose?.trim() || 'AnkiGen Hub'}
                />
              )}
              <DeleteHistoryButton recordId={selected.id} />
            </div>
          </div>

          {selected.source === 'slides-occlusion' && (
            <p className="mb-3 text-xs text-text-secondary">
              Image Occlusion 需要在 Anki 裡手動畫遮蓋範圍，暫不支援直接存入 Anki，請用下方每張卡片的下載連結
              + CSV。
            </p>
          )}

          <div className="flex flex-col gap-3">
            {selected.source === 'mcq' &&
              (selected.cards as McqCard[]).map((card, index) => (
                <McqCardItem key={index} card={card} recordId={selected.id} cardIndex={index} />
              ))}
            {selected.source === 'slides-mcq' &&
              (selected.cards as SlidesMcqCard[]).map((card, index) => (
                <HistoryCardItem key={index} card={card} recordId={selected.id} cardIndex={index} />
              ))}
            {selected.source === 'slides-occlusion' &&
              (selected.cards as OcclusionCard[]).map((card, index) => (
                <OcclusionCardItem key={index} card={card} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

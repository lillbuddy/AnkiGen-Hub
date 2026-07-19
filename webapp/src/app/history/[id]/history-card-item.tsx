'use client'

import { useEffect, useState } from 'react'
import { addToDrawer, isInDrawer, removeFromDrawer } from '@/lib/drawer-storage'
import type { SlidesMcqCard } from '@/lib/history-types'

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF'] as const

export default function HistoryCardItem({
  card,
  recordId,
  cardIndex,
}: {
  card: SlidesMcqCard
  recordId: string
  cardIndex: number
}) {
  const key = `${recordId}:${cardIndex}`
  const [inDrawer, setInDrawer] = useState(false)

  useEffect(() => {
    // 同上：localStorage 只在瀏覽器端讀得到，故意等 mount 後才讀。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInDrawer(isInDrawer(key))
  }, [key])

  function toggleDrawer() {
    if (inDrawer) {
      removeFromDrawer(key)
      setInDrawer(false)
    } else {
      addToDrawer({ ...card, key, sourceRecordId: recordId })
      setInDrawer(true)
    }
  }

  const correctLetters = (card.answer || '').toUpperCase().replace(/[^A-F]/g, '').split('')

  return (
    <div className="flex gap-4 rounded border border-gray-300 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/google-drive/image/${card.drivePreviewFileId}`}
        alt={card.filename}
        className="h-24 w-24 flex-shrink-0 rounded object-cover"
      />
      <div className="flex flex-1 flex-col gap-1">
        <div className="text-sm font-medium">{card.questionText}</div>
        <div className="grid grid-cols-2 gap-x-2 text-sm">
          {OPTION_KEYS.map((k, i) => {
            const letter = String.fromCharCode(65 + i)
            const text = card[k]
            if (!text) return null
            const isCorrect = correctLetters.includes(letter)
            return (
              <div key={k} className={isCorrect ? 'font-semibold text-green-700' : ''}>
                {letter}. {text}
              </div>
            )
          })}
        </div>
        {card.notes && <div className="text-xs text-gray-500">{card.notes}</div>}
        <div className="mt-1 flex gap-3">
          <a
            href={`/api/google-drive/image/${card.driveFileId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 underline"
          >
            下載原始圖片
          </a>
          <button
            onClick={toggleDrawer}
            className={`text-xs underline ${inDrawer ? 'text-red-600' : 'text-blue-600'}`}
          >
            {inDrawer ? '從抽屜移除' : '加入抽屜'}
          </button>
        </div>
      </div>
    </div>
  )
}

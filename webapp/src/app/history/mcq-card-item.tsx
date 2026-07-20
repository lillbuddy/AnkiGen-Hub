'use client'

import { useEffect, useState } from 'react'
import { addToDrawer, isInDrawer, removeFromDrawer } from '@/lib/drawer-storage'
import type { McqCard } from '@/lib/history-types'

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF'] as const

export default function McqCardItem({
  card,
  recordId,
  cardIndex,
}: {
  card: McqCard
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
      const result = addToDrawer({ ...card, key, sourceRecordId: recordId, cardType: 'mcq' })
      if (!result.ok) {
        alert(result.reason)
        return
      }
      setInDrawer(true)
    }
  }

  const correctLetters = (card.answer || '').toUpperCase().replace(/[^A-F]/g, '').split('')

  return (
    <div className="card-panel p-3">
      <div className="text-sm font-medium">{card.questionText}</div>
      <div className="grid grid-cols-2 gap-x-2 text-sm">
        {OPTION_KEYS.map((k, i) => {
          const letter = String.fromCharCode(65 + i)
          const text = card[k]
          if (!text) return null
          const isCorrect = correctLetters.includes(letter)
          return (
            <div key={k} className={isCorrect ? 'font-semibold text-success' : ''}>
              {letter}. {text}
            </div>
          )
        })}
      </div>
      {card.notes && <div className="text-xs text-text-secondary">{card.notes}</div>}
      <div className="mt-1">
        <button
          onClick={toggleDrawer}
          className={`text-xs underline ${inDrawer ? 'text-danger' : 'text-primary'}`}
        >
          {inDrawer ? '從抽屜移除' : '加入抽屜'}
        </button>
      </div>
    </div>
  )
}

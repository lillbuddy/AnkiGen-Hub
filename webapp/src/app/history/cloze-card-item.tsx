'use client'

import { splitClozeSentence } from '@/lib/cloze-markup'
import type { ClozeCard } from '@/lib/history-types'

export default function ClozeCardItem({ card }: { card: ClozeCard }) {
  const parts = splitClozeSentence(card.sentence)

  return (
    <div className="card-panel p-3">
      <div className="text-sm font-medium">{card.word}</div>
      <div className="text-sm">
        {parts ? (
          <>
            {parts.before}
            <span className="font-semibold text-primary underline">{parts.blank}</span>
            {parts.after}
          </>
        ) : (
          card.sentence
        )}
      </div>
      {card.notes && <div className="text-xs text-text-secondary">{card.notes}</div>}
    </div>
  )
}

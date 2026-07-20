import type { McqCard } from '@/lib/history-types'

const OPTION_KEYS = ['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF'] as const

export default function McqCardItem({ card }: { card: McqCard }) {
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
    </div>
  )
}
